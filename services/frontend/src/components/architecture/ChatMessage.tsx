import type { Message } from "../../types/architecture";
import ClarificationCard from "./ClarificationCard";
import ValidationFixCard from "./ValidationFixCard";
import { useArchitectureStore } from "../../stores/architectureStore";

const STEP_COLORS: Record<string, string> = {
  parsing:    "#00d4ff",
  querying:   "#f59e0b",
  reasoning:  "#8b5cf6",
  validating: "#f43f5e",
  estimating: "#6366f1",
  complete:   "#10b981",
};

const STEP_LABELS: Record<string, string> = {
  parsing:             "Parsing",
  querying:            "Querying",
  reasoning:           "Reasoning",
  validating:          "Validating",
  self_correcting:     "Self-Correcting",
  asking_clarification:"Clarification",
  estimating:          "Estimating",
  complete:            "Complete",
};

function StepMessage({ message }: { message: Message }) {
  const step = message.step || message.type;
  const color = STEP_COLORS[step] || "#94a3b8";
  const label = STEP_LABELS[step] || step;

  // Split into sentences for line-by-line reveal
  const lines = message.content
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="flex gap-3 py-1">
      {/* Colored dot */}
      <div className="mt-1.5 shrink-0">
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px 1px ${color}66` }}
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* Step label */}
        <div
          className="text-sm font-bold mb-1"
          style={{ color }}
        >
          {label}
        </div>

        {/* Content — line by line reveal */}
        <div className="space-y-0.5">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-[12.5px] leading-relaxed text-foreground/75 line-reveal"
              style={{ animationDelay: `${i * 1000}ms` }}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatMessage({ message }: { message: Message }) {
  // User bubble
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md text-white text-sm"
          style={{
            background: "oklch(0.68 0.19 255 / 0.9)",
            boxShadow: "0 0 20px -6px oklch(0.68 0.19 255 / 0.8)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // Chat Q&A response — plain assistant text bubble
  if (message.type === "chat_response") {
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full" style={{ background: "#00d4ff", boxShadow: "0 0 6px 1px #00d4ff66" }} />
        </div>
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#00d4ff" }}>ArchMind</div>
          <p className="text-[12.5px] text-foreground/75 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Reasoning steps (have a step label) — skip "complete" step, it's clubbed into architecture message
  if (message.step || message.type === "reasoning") {
    if (message.step === "complete") return null;
    return <StepMessage message={message} />;
  }

  // Complete
  if (message.type === "complete") {
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: "#10b981", boxShadow: "0 0 6px 1px #10b98166" }}
          />
        </div>
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#10b981" }}>Complete</div>
          <p className="text-[12.5px] text-foreground/75">Architecture ready for review.</p>
        </div>
      </div>
    );
  }

  // Warning
  if (message.type === "warning") {
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 6px 1px #f59e0b66" }} />
        </div>
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#f59e0b" }}>Warning</div>
          <p className="text-[12.5px] text-foreground/75">{message.content}</p>
        </div>
      </div>
    );
  }

  // Architecture summary — LLM-generated explanation
  if (message.type === "summary") {
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full" style={{ background: "#8b5cf6", boxShadow: "0 0 6px 1px #8b5cf666" }} />
        </div>
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#8b5cf6" }}>ArchMind</div>
          <p className="text-[12.5px] leading-relaxed text-foreground/75 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Architecture generated — single "complete" indicator
  if (message.type === "architecture") {
    const svcCount = message.data?.services?.length || 0;
    const connCount = message.data?.connections?.length || 0;
    const cost = message.data?.metadata?.estimated_cost_monthly;
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full" style={{ background: "#10b981", boxShadow: "0 0 6px 1px #10b98166" }} />
        </div>
        <div>
          <div className="text-sm font-bold mb-1" style={{ color: "#10b981" }}>Complete</div>
          <p className="text-[12.5px] text-foreground/75 line-reveal" style={{ animationDelay: "0ms" }}>
            Architecture ready. Sending final output to canvas.
          </p>
          {svcCount > 0 && (
            <p className="text-[12.5px] text-foreground/75 line-reveal" style={{ animationDelay: "120ms" }}>
              {svcCount} services · {connCount} connections{cost ? ` · $${cost}/mo` : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Tool call
  if (message.type === "tool_call") {
    return (
      <div className="flex gap-3 py-1 pl-5">
        <p className="text-[11.5px] text-muted-foreground/60 italic">{message.content}</p>
      </div>
    );
  }

  // Clarification needed
  if (message.type === "clarification_needed") {
    const awaiting = useArchitectureStore.getState().awaitingClarification;
    const frozen = awaiting === null;
    return (
      <div className="space-y-3 py-2">
        <div className="flex gap-3">
          <div className="mt-1 shrink-0">
            <div className="h-2 w-2 rounded-full" style={{ background: "#f59e0b", boxShadow: "0 0 6px 1px #f59e0b66" }} />
          </div>
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: "#f59e0b" }}>Clarification Needed</div>
            <p className="text-[12.5px] text-foreground/75 mb-2">{message.content}</p>
          </div>
        </div>
        <div className="space-y-3 pl-7">
          {(message.questions || []).map((q) => (
            <ClarificationCard key={q.id} question={q} frozen={frozen} />
          ))}
        </div>
      </div>
    );
  }

  // Validation fixes needed
  if (message.type === "validation_fixes_needed") {
    const fixes = useArchitectureStore.getState().pendingValidationFixes;
    const frozen = fixes === null;
    return (
      <div className="space-y-3 py-2">
        <div className="flex gap-3">
          <div className="mt-1 shrink-0">
            <div className="h-2 w-2 rounded-full" style={{ background: "#f43f5e", boxShadow: "0 0 6px 1px #f43f5e66" }} />
          </div>
          <div>
            <div className="text-sm font-bold mb-1" style={{ color: "#f43f5e" }}>Validation Issues Found</div>
            <p className="text-[12.5px] text-foreground/75 mb-2">{message.content}</p>
          </div>
        </div>
        <div className="space-y-3 pl-7">
          {(message.fixes || []).map((f) => (
            <ValidationFixCard key={f.fix_id} fix={f} frozen={frozen} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
