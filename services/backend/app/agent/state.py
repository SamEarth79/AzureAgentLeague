from operator import add
from typing import Annotated, Any, Dict, List, Optional

from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict

from ..models.domain import (
    Architecture,
    ArchitectureMetadata,
    Connection,
    Service,
    Warning,
)


class AgentState(TypedDict, total=False):
    messages: Annotated[List[BaseMessage], add]

    user_requirements: Dict[str, Any]

    selected_services: List[Service]
    connections: List[Connection]
    warnings: Annotated[List[Warning], add]
    metadata: ArchitectureMetadata

    iteration: int
    status: str
    needs_clarification: bool
    validation_passed: bool
    is_refinement: bool

    session_id: str
    existing_architecture: Optional[Architecture]
    user_message: str

    pending_clarifications: List[Dict[str, Any]]
    pending_missing_fields: List[str]
    is_clarification_response: bool
    original_prompt: Optional[str]

    pending_validation_fixes: List[Dict[str, Any]]
    is_validation_response: bool
    validation_fix_choices: Dict[str, bool]
