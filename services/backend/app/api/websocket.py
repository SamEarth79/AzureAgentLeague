import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from langchain.schema import AIMessage

from ..agent import run_agent
from ..agent.commands import audit_architecture, explain_architecture, optimize_architecture
from ..agent.failure_sim import simulate_failure
from ..agent.scenario_sim import simulate_scenario
from ..core import SessionNotFoundError, session_manager
from ..models.domain import Architecture

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/api/sessions/{session_id}/stream")
async def stream_session(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    if not session_manager.session_exists(session_id):
        await websocket.send_json(
            {"type": "error", "content": f"Session {session_id} not found"}
        )
        await websocket.close(code=4404)
        return

    logger.info("WebSocket connected for session %s", session_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "content": "Invalid JSON payload"}
                )
                continue

            message_type = payload.get("type")
            content = payload.get("content", "")

            # Failure simulation — pure computation, no agent run needed
            if message_type == "failure_simulation":
                service_id = payload.get("service_id", "")
                try:
                    session = session_manager.get_session(session_id)
                    arch = session.current_architecture
                    if arch and service_id:
                        result = simulate_failure(arch, service_id)
                        if result:
                            await websocket.send_json({"type": "failure_simulation_result", **result})
                        else:
                            await websocket.send_json({"type": "error", "content": "Service not found in architecture"})
                    else:
                        await websocket.send_json({"type": "error", "content": "No architecture available for simulation"})
                except Exception:
                    logger.exception("Failure simulation error for session %s", session_id)
                continue

            # Scenario simulation — LLM-powered, no agent graph run needed
            if message_type == "simulate_scenario":
                scenario = payload.get("scenario", "").strip()
                try:
                    session = session_manager.get_session(session_id)
                    arch = session.current_architecture
                    if not arch:
                        await websocket.send_json({"type": "error", "content": "No architecture loaded. Generate one first."})
                    elif not scenario:
                        await websocket.send_json({"type": "error", "content": "No scenario provided."})
                    else:
                        result = await simulate_scenario(arch, scenario, session_id)
                        await websocket.send_json({
                            "type": "simulate_scenario_result",
                            "reasoning": result.get("reasoning", ""),
                            "failure_map": result.get("failure_map"),
                            "scenario": scenario,
                        })
                except Exception:
                    logger.exception("Scenario simulation error for session %s", session_id)
                    await websocket.send_json({"type": "error", "content": "Scenario simulation failed."})
                continue

            # /optimize — LLM rewrites architecture toward a goal
            if message_type == "optimize_architecture":
                goal = payload.get("goal", "cost").strip()
                try:
                    session = session_manager.get_session(session_id)
                    arch = session.current_architecture
                    if not arch:
                        await websocket.send_json({"type": "error", "content": "No architecture loaded. Generate one first."})
                    else:
                        result = await optimize_architecture(arch, goal, session_id)
                        new_arch = result.get("architecture")
                        if new_arch:
                            session_manager.update_session(session_id, current_architecture=new_arch, status="complete")
                        await websocket.send_json({
                            "type": "optimize_result",
                            "reasoning": result.get("reasoning", ""),
                            "architecture": new_arch.model_dump() if new_arch else None,
                            "goal": goal,
                        })
                except Exception:
                    logger.exception("Optimize error for session %s", session_id)
                    await websocket.send_json({"type": "error", "content": "Optimization failed."})
                continue

            # /audit — security and compliance scan
            if message_type == "audit_architecture":
                try:
                    session = session_manager.get_session(session_id)
                    arch = session.current_architecture
                    if not arch:
                        await websocket.send_json({"type": "error", "content": "No architecture loaded. Generate one first."})
                    else:
                        result = await audit_architecture(arch, session_id)
                        await websocket.send_json({
                            "type": "audit_result",
                            "reasoning": result.get("reasoning", ""),
                        })
                except Exception:
                    logger.exception("Audit error for session %s", session_id)
                    await websocket.send_json({"type": "error", "content": "Audit failed."})
                continue

            # /explain — explain architecture to a target audience
            if message_type == "explain_architecture":
                audience = payload.get("audience", "cto").strip()
                try:
                    session = session_manager.get_session(session_id)
                    arch = session.current_architecture
                    if not arch:
                        await websocket.send_json({"type": "error", "content": "No architecture loaded. Generate one first."})
                    else:
                        result = await explain_architecture(arch, audience, session_id)
                        await websocket.send_json({
                            "type": "explain_result",
                            "reasoning": result.get("reasoning", ""),
                            "audience": audience,
                        })
                except Exception:
                    logger.exception("Explain error for session %s", session_id)
                    await websocket.send_json({"type": "error", "content": "Explanation failed."})
                continue

            if message_type != "user_message" or not content:
                await websocket.send_json(
                    {
                        "type": "error",
                        "content": "Expected message of type 'user_message' with non-empty content",
                    }
                )
                continue

            try:
                session = session_manager.update_session(
                    session_id,
                    append_message={"role": "user", "content": content},
                    status="active",
                )
            except SessionNotFoundError:
                await websocket.send_json(
                    {"type": "error", "content": f"Session {session_id} not found"}
                )
                await websocket.close(code=4404)
                return

            is_answering = session.has_pending_clarifications()
            is_validating = session.has_pending_validation_fixes()
            original_prompt = session.original_prompt if is_answering else None
            if is_answering:
                session_manager.set_original_prompt(session_id, None)
                session_manager.clear_pending_clarifications(session_id)
            if is_validating:
                session_manager.clear_pending_validation_fixes(session_id)

            existing_arch = session.current_architecture

            # If content is a JSON blob with a manual architecture (from re-validate button),
            # use it as the existing architecture instead of the session-stored one
            try:
                parsed_content = json.loads(content)
                if isinstance(parsed_content, dict) and parsed_content.get("type") == "revalidate_manual":
                    arch_data = parsed_content.get("architecture")
                    if arch_data:
                        existing_arch = Architecture(**arch_data)
                        content = "Re-validate"
                elif isinstance(parsed_content, dict) and parsed_content.get("type") == "apply_optimization":
                    arch_data = parsed_content.get("architecture")
                    if arch_data:
                        existing_arch = Architecture(**arch_data)
                        session_manager.update_session(session_id, current_architecture=existing_arch)
                    content = "Apply the optimization suggestions to the current architecture, validate it, and produce the final output."
            except (json.JSONDecodeError, TypeError, Exception):
                pass

            async def send(event: Dict[str, Any]) -> None:
                await websocket.send_json(event)

            # Parse validation fix choices from response
            validation_fix_choices: Dict[str, bool] = {}
            if is_validating and not is_answering:
                import re as _re
                apply_match = _re.search(r"apply:\s*(.+?)(?:\.|$)", content, _re.IGNORECASE)
                skip_match = _re.search(r"skip:\s*(.+?)(?:\.|$)", content, _re.IGNORECASE)
                if apply_match:
                    for fid in _re.split(r"[,\s]+", apply_match.group(1).strip()):
                        if fid:
                            validation_fix_choices[fid] = True
                if skip_match:
                    for fid in _re.split(r"[,\s]+", skip_match.group(1).strip()):
                        if fid:
                            validation_fix_choices[fid] = False

            try:
                final_state = await run_agent(
                    session_id=session_id,
                    user_message=content,
                    message_history=list(session.messages),
                    websocket_sender=send,
                    existing_architecture=existing_arch,
                    is_clarification_response=is_answering,
                    original_prompt=original_prompt,
                    is_validation_response=is_validating,
                    validation_fix_choices=validation_fix_choices if validation_fix_choices else None,
                )
            except Exception:
                logger.exception("Agent run failed for session %s", session_id)
                try:
                    await websocket.send_json(
                        {"type": "error", "content": "Agent run failed; see server logs."}
                    )
                    await websocket.send_json({"type": "complete"})
                except Exception:
                    pass
                continue

            # Chat Q&A path — save answer to history, don't touch current_architecture
            if final_state.get("chat_answer_text"):
                session_manager.update_session(
                    session_id,
                    append_message={"role": "assistant", "content": final_state["chat_answer_text"]},
                    status="complete",
                )
                continue

            pending_questions = list(final_state.get("pending_clarifications") or [])
            if pending_questions:
                session_manager.set_pending_clarifications(
                    session_id,
                    questions=pending_questions,
                    missing_fields=list(final_state.get("pending_missing_fields") or []),
                )
                if not is_answering:
                    session_manager.set_original_prompt(session_id, content)

                last_ai = next(
                    (m for m in reversed(final_state.get("messages") or []) if isinstance(m, AIMessage)),
                    None,
                )
                question_text = last_ai.content if last_ai else "I need a few more details."
                session_manager.update_session(
                    session_id,
                    append_message={"role": "assistant", "content": question_text},
                )
                continue

            pending_fixes = list(final_state.get("pending_validation_fixes") or [])
            if pending_fixes:
                session_manager.set_pending_validation_fixes(
                    session_id,
                    fixes=pending_fixes,
                )

                last_ai = next(
                    (m for m in reversed(final_state.get("messages") or []) if isinstance(m, AIMessage)),
                    None,
                )
                fix_text = last_ai.content if last_ai else "Validation fixes needed."
                session_manager.update_session(
                    session_id,
                    append_message={"role": "assistant", "content": fix_text},
                )
                continue

            architecture = Architecture(
                services=list(final_state.get("selected_services") or []),
                connections=list(final_state.get("connections") or []),
                metadata=final_state.get("metadata"),
                warnings=list(final_state.get("warnings") or []),
            )

            try:
                session_manager.update_session(
                    session_id,
                    current_architecture=architecture,
                    status="complete",
                )
            except SessionNotFoundError:
                return

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception:
        logger.exception("WebSocket error for session %s", session_id)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
