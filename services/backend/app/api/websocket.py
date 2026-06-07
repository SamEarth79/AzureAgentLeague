import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from langchain.schema import AIMessage

from ..agent import run_agent
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
            original_prompt = session.original_prompt if is_answering else None
            if is_answering:
                session_manager.set_original_prompt(session_id, None)
                session_manager.clear_pending_clarifications(session_id)

            existing_arch = session.current_architecture

            async def send(event: Dict[str, Any]) -> None:
                await websocket.send_json(event)

            try:
                final_state = await run_agent(
                    session_id=session_id,
                    user_message=content,
                    message_history=list(session.messages),
                    websocket_sender=send,
                    existing_architecture=existing_arch,
                    is_clarification_response=is_answering,
                    original_prompt=original_prompt,
                )
            except Exception:
                logger.exception("Agent run failed for session %s", session_id)
                try:
                    await websocket.send_json(
                        {"type": "error", "content": "Agent run failed; see server logs."}
                    )
                except Exception:
                    pass
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
