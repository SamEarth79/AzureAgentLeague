import logging
from http import HTTPStatus

from fastapi import APIRouter, HTTPException

from ..core import SessionNotFoundError, session_manager
from ..models import (
    CreateSessionRequest,
    ExportRequest,
    ExportResponse,
    SessionDetailResponse,
    SessionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", tags=["health"])
async def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "archmind-backend",
        "active_sessions": session_manager.count(),
    }


@router.post(
    "/api/sessions",
    response_model=SessionResponse,
    status_code=HTTPStatus.CREATED,
    tags=["sessions"],
)
async def create_session(payload: CreateSessionRequest) -> SessionResponse:
    session = session_manager.create_session()
    session_manager.update_session(
        session.session_id,
        append_message={"role": "user", "content": payload.initial_prompt},
    )
    logger.info("Created session %s", session.session_id)
    return SessionResponse(
        session_id=session.session_id,
        status=session.status,
        created_at=session.created_at,
    )


@router.get(
    "/api/sessions/{session_id}",
    response_model=SessionDetailResponse,
    tags=["sessions"],
)
async def get_session(session_id: str) -> SessionDetailResponse:
    try:
        session = session_manager.get_session(session_id)
    except SessionNotFoundError:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail=f"Session {session_id} not found",
        )

    return SessionDetailResponse(
        session_id=session.session_id,
        status=session.status,
        created_at=session.created_at,
        updated_at=session.updated_at,
        history=list(session.messages),
        current_architecture=session.current_architecture,
        pending_clarifications=list(session.pending_clarifications),
        pending_missing_fields=list(session.pending_missing_fields),
        original_prompt=session.original_prompt,
    )


@router.post(
    "/api/sessions/{session_id}/export",
    response_model=ExportResponse,
    status_code=HTTPStatus.NOT_IMPLEMENTED,
    tags=["sessions"],
)
async def export_architecture(session_id: str, payload: ExportRequest) -> ExportResponse:
    if not session_manager.session_exists(session_id):
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    raise HTTPException(
        status_code=HTTPStatus.NOT_IMPLEMENTED,
        detail=f"Export to {payload.format} is not implemented yet",
    )
