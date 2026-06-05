from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from .domain import Architecture


class SessionResponse(BaseModel):
    session_id: str
    status: str
    created_at: datetime


class SessionDetailResponse(BaseModel):
    session_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    history: List[dict]
    current_architecture: Optional[Architecture] = None


class ExportResponse(BaseModel):
    url: str
