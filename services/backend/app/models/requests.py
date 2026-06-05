from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    initial_prompt: str = Field(..., min_length=1, max_length=4000)


class UserMessageRequest(BaseModel):
    type: str = "user_message"
    content: str = Field(..., min_length=1, max_length=8000)


class ExportRequest(BaseModel):
    format: Literal["json", "png", "svg"]
