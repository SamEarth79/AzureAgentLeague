import React from "react";
import type { Message } from "../../types/architecture";
import ClarificationCard from "./ClarificationCard";
import ValidationFixCard from "./ValidationFixCard";
import { useArchitectureStore } from "../../stores/architectureStore";

function renderInline(text: string): React.ReactNode {
  // Render **bold** and `code` spans within a line
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="text-foreground/90 font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="px-1 py-0.5 rounded text-[11px] font-mono bg-white/[0.08] text-foreground/80">{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // blank line → small spacer only if not consecutive
      const prev = elements[elements.length - 1];
      if (prev) elements.push(<div key={key++} className="h-1.5" />);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <p key={key++} className="text-[11.5px] font-semibold uppercase tracking-wider mt-3 mb-0.5" style={{ color: "#8b5cf6" }}>
          {renderInline(trimmed.slice(4))}
        </p>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={key++} className="text-[13px] font-bold mt-3 mb-1" style={{ color: "#c4b5fd" }}>
          {renderInline(trimmed.slice(3))}
        </p>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <p key={key++} className="text-[14px] font-bold mt-1 mb-1.5" style={{ color: "#e9d5ff" }}>
          {renderInline(trimmed.slice(2))}
        </p>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={key++} className="flex gap-1.5 text-[12.5px] leading-relaxed text-foreground/75">
          <span className="shrink-0 mt-0.5" style={{ color: "#8b5cf6" }}>·</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={key++} className="text-[12.5px] leading-relaxed text-foreground/75">
          {renderInline(trimmed)}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

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

  return (
    <div className="flex gap-3 py-1">
      <div className="mt-1.5 shrink-0">
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px 1px ${color}66` }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold mb-1" style={{ color }}>
          {label}
        </div>
        <MarkdownBlock content={message.content} />
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

  // Architecture summary — LLM-generated explanation with markdown rendering
  if (message.type === "summary") {
    return (
      <div className="flex gap-3 py-1">
        <div className="mt-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full" style={{ background: "#8b5cf6", boxShadow: "0 0 6px 1px #8b5cf666" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold mb-2" style={{ color: "#8b5cf6" }}>ArchMind</div>
          <MarkdownBlock content={message.content} />
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
    const awaiting = useArchitectureStore((s) => s.awaitingClarification);
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
        <div className="pl-7">
          <ClarificationCard questions={message.questions || []} frozen={frozen} />
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
