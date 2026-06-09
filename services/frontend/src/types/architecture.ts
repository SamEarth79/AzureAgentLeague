export interface Service {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  icon: string;
  cost_estimate?: number;
  region?: string;
  position?: { x: number; y: number };
  reasoning?: string;
  config?: Record<string, any>;
  foundry_iq_query?: string;
  foundry_iq_docs_link?: string;
  foundry_iq_confidence?: number;
}

export interface Connection {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  protocol?: string;
}

export interface Warning {
  id: string;
  severity: "high" | "medium" | "low";
  message: string;
  suggested_fix?: string;
}

export interface ArchitectureMetadata {
  estimated_cost_monthly: number;
  estimated_latency_p95: string;
  estimated_throughput: string;
  sla: string;
  budget_cap?: number;
  iteration?: number;
}

export interface Architecture {
  services: Service[];
  connections: Connection[];
  metadata: ArchitectureMetadata;
  warnings: Warning[];
}

export interface FailureImpact {
  id: string;
  name: string;
  severity: "direct_failure" | "degraded" | "delayed_impact";
  reason: string;
}

export interface FailureSimResult {
  failed_service_id: string;
  failed_service_name: string;
  impacted: FailureImpact[];
  unaffected_count: number;
  overall_status: "full_outage" | "partial_outage" | "degraded";
  summary: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ValidationFixProposal {
  fix_id: string;
  warning_message: string;
  suggested_fix: string;
  category: string;
  affected_services: string[];
}

export interface Message {
  role: "user" | "assistant" | "system";
  type: "reasoning" | "tool_call" | "tool_result" | "warning" | "architecture" | "complete" | "clarification_needed" | "validation_fixes_needed" | "chat_response" | "summary";
  content: string;
  step?: string;
  data?: any;
  questions?: ClarificationQuestion[];
  missing_fields?: string[];
  fixes?: ValidationFixProposal[];
}
