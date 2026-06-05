import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import RLock
from typing import Dict, List, Optional

from ..models.domain import Architecture


@dataclass
class Session:
    session_id: str
    created_at: datetime
    updated_at: datetime
    messages: List[dict] = field(default_factory=list)
    current_architecture: Optional[Architecture] = None
    status: str = "active"


class SessionNotFoundError(Exception):
    pass


class SessionManager:
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._lock = RLock()

    def create_session(self) -> Session:
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        session = Session(
            session_id=session_id,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Session:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)
            return session

    def update_session(
        self,
        session_id: str,
        *,
        messages: Optional[List[dict]] = None,
        current_architecture: Optional[Architecture] = None,
        status: Optional[str] = None,
        append_message: Optional[dict] = None,
    ) -> Session:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                raise SessionNotFoundError(session_id)

            if messages is not None:
                session.messages = messages
            if current_architecture is not None:
                session.current_architecture = current_architecture
            if status is not None:
                session.status = status
            if append_message is not None:
                session.messages.append(append_message)
            session.updated_at = datetime.now(timezone.utc)
            return session

    def session_exists(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._sessions

    def count(self) -> int:
        with self._lock:
            return len(self._sessions)


session_manager = SessionManager()
