from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Service(BaseModel):
    id: str
    type: str
    name: str
    config: Dict = Field(default_factory=dict)
    reasoning: str = ""
    cost_estimate: Optional[float] = None
    region: str = "eastus"


class Connection(BaseModel):
    id: str
    source_id: str
    target_id: str
    type: str = "sync"
    protocol: Optional[str] = None


class ArchitectureMetadata(BaseModel):
    estimated_cost_monthly: float = 0.0
    estimated_latency_p95: str = ""
    estimated_throughput: str = ""
    regions: List[str] = Field(default_factory=list)
    compliance: List[str] = Field(default_factory=list)
    failure_scenarios: List[str] = Field(default_factory=list)


class Warning(BaseModel):
    severity: str
    category: str
    message: str
    affected_services: List[str] = Field(default_factory=list)
    suggested_fix: Optional[str] = None


class Architecture(BaseModel):
    services: List[Service] = Field(default_factory=list)
    connections: List[Connection] = Field(default_factory=list)
    metadata: ArchitectureMetadata = Field(default_factory=ArchitectureMetadata)
    warnings: List[Warning] = Field(default_factory=list)
