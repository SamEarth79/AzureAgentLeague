import asyncio
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..core import SessionNotFoundError, session_manager

logger = logging.getLogger(__name__)

router = APIRouter()

STREAM_DELAY_SECONDS = 0.4


def _mock_architecture_payload() -> Dict[str, Any]:
    return {
        "services": [
            {
                "id": "svc-functions",
                "type": "Azure Functions",
                "name": "Image Processor",
                "config": {"plan": "consumption", "runtime": "python"},
                "reasoning": "Serverless compute scales with image processing load.",
                "cost_estimate": 12.0,
                "region": "eastus",
            },
            {
                "id": "svc-blob",
                "type": "Azure Blob Storage",
                "name": "Image Store",
                "config": {"tier": "Hot", "redundancy": "LRS"},
                "reasoning": "Durable storage for uploaded images.",
                "cost_estimate": 1.84,
                "region": "eastus",
            },
        ],
        "connections": [
            {
                "id": "conn-1",
                "source_id": "svc-blob",
                "target_id": "svc-functions",
                "type": "event-driven",
                "protocol": "Event Grid",
            }
        ],
        "metadata": {
            "estimated_cost_monthly": 13.84,
            "estimated_latency_p95": "800ms",
            "estimated_throughput": "100 req/s",
            "regions": ["eastus"],
            "compliance": [],
            "failure_scenarios": ["Function cold start under burst load"],
        },
        "warnings": [],
    }


async def _stream_mock_response(websocket: WebSocket, user_content: str) -> None:
    events: list[Dict[str, Any]] = [
        {
            "type": "reasoning",
            "content": "Analyzing requirements and constraints...",
            "step": "parsing",
        },
        {
            "type": "tool_call",
            "tool": "query_foundry_iq",
            "args": {"query": user_content},
        },
        {
            "type": "tool_result",
            "tool": "query_foundry_iq",
            "result": "Found 3 candidate Azure services matching the workload.",
        },
        {
            "type": "reasoning",
            "content": "Selecting Azure services based on cost, scale, and latency...",
            "step": "selection",
        },
        {
            "type": "warning",
            "content": "Single region deployment — no geo-redundancy configured.",
            "severity": "medium",
        },
        {
            "type": "architecture",
            "data": _mock_architecture_payload(),
        },
        {"type": "complete"},
    ]

    for event in events:
        await asyncio.sleep(STREAM_DELAY_SECONDS)
        await websocket.send_json(event)


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
                session_manager.update_session(
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

            await _stream_mock_response(websocket, content)

            try:
                session_manager.update_session(session_id, status="complete")
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
