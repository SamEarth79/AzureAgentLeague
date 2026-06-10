import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Cpu, Layers, Radio, Zap, Shield, TrendingUp, Globe, Database, Lock, DollarSign, Search, Users } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";
import ChatMessage from "./ChatMessage";

const SLASH_COMMANDS: Record<string, {
  description: string;
  icon: React.ElementType;
  color: string;
  args?: { label: string; value: string; icon: React.ElementType }[];
}> = {
  simulate: {
    description: "Simulate a failure scenario against the architecture",
    icon: Zap,
    color: "#8b5cf6",
    args: [
      { label: "ddos",           value: "ddos",           icon: Shield },
      { label: "rush_hour",      value: "rush_hour",      icon: TrendingUp },
      { label: "region_failure", value: "region_failure", icon: Globe },
      { label: "data_breach",    value: "data_breach",    icon: Lock },
      { label: "scale",          value: "scale",          icon: TrendingUp },
      { label: "db_failure",     value: "db_failure",     icon: Database },
    ],
  },
  optimize: {
    description: "Rewrite the architecture toward a specific goal",
    icon: TrendingUp,
    color: "#10b981",
    args: [
      { label: "cost",        value: "cost",        icon: DollarSign },
      { label: "latency",     value: "latency",     icon: Zap },
      { label: "reliability", value: "reliability", icon: Shield },
      { label: "security",    value: "security",    icon: Lock },
      { label: "scalability", value: "scalability", icon: Globe },
    ],
  },
  audit: {
    description: "Security & compliance audit of the current architecture",
    icon: Search,
    color: "#f43f5e",
  },
  explain: {
    description: "Explain the architecture to a specific audience",
    icon: Users,
    color: "#f59e0b",
    args: [
      { label: "cto",      value: "cto",      icon: Users },
      { label: "investor", value: "investor", icon: Users },
      { label: "developer", value: "developer", icon: Users },
      { label: "devops",   value: "devops",   icon: Users },
      { label: "product",  value: "product",  icon: Users },
    ],
  },
};

const SLASH_RE = /^\/(\w+)\s+(.+)/i;

export default function ChatPanel({
  className,
  onSendMessage,
  onSimulate,
  onOptimize,
  onAudit,
  onExplain,
  onApplyOptimization,
}: {
  className?: string;
  onSendMessage: (msg: string) => void;
  onSimulate?: (scenario: string) => void;
  onOptimize?: (goal: string) => void;
  onAudit?: () => void;
  onExplain?: (audience: string) => void;
  onApplyOptimization?: (arch: any) => void;
}) {
  const [input, setInput] = useState("");
  const messages = useArchitectureStore((s) => s.messages);
  const sessionId = useArchitectureStore((s) => s.sessionId);
  const isConnected = useArchitectureStore((s) => s.isConnected);
  const isLoading = useArchitectureStore((s) => s.isLoading);
  const setLoading = useArchitectureStore((s) => s.setLoading);
  const awaitingClarification = useArchitectureStore((s) => s.awaitingClarification);
  const clarificationAnswers = useArchitectureStore((s) => s.clarificationAnswers);
  const clearClarifications = useArchitectureStore((s) => s.clearClarifications);
  const pendingValidationFixes = useArchitectureStore((s) => s.pendingValidationFixes);
  const validationFixChoices = useArchitectureStore((s) => s.validationFixChoices);
  const clearValidationFixes = useArchitectureStore((s) => s.clearValidationFixes);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = sessionId === null || isConnected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canSend || isLoading) return;
    const trimmed = input.trim();
    // Slash commands with an arg
    const match = trimmed.match(SLASH_RE);
    if (match) {
      const cmd = match[1].toLowerCase();
      const arg = match[2].trim();
      if (cmd === "simulate") { onSimulate?.(arg); setInput(""); return; }
      if (cmd === "optimize") { onOptimize?.(arg); setInput(""); return; }
      if (cmd === "explain")  { onExplain?.(arg);  setInput(""); return; }
    }
    // Slash commands with no arg
    if (trimmed === "/audit") { onAudit?.(); setInput(""); return; }
    setLoading(true);
    await onSendMessage(input);
    setInput("");
  };

  const handleClarificationSubmit = useCallback(() => {
    if (!awaitingClarification) return;

    const OPTION_TO_KEYWORD: Record<string, Record<string, string>> = {
      workload: {
        "Web API / REST Service": "rest api web service",
        "Real-time streaming pipeline": "streaming telemetry pipeline",
        "AI / ML workload": "ai openai gpt workload",
        "Image or video processing": "image vision processing",
        "Microservices platform": "microservices kubernetes",
        "Serverless / event-driven": "serverless event driven",
        "Data pipeline / ETL": "etl data pipeline",
      },
      scale: {
        "Low  —  under 1K req/min": "small traffic low scale demo prototype",
        "Medium  —  1K–10K req/min": "medium traffic scale",
        "High  —  10K–100K req/min": "high scale 10000 requests burst",
        "Very High  —  100K+ req/min": "millions burst very high traffic",
      },
      region: {
        "East US": "eastus",
        "West US 2": "westus2",
        "West Europe": "westeurope",
        "Southeast Asia": "southeastasia",
        "Australia East": "australiaeast",
        "UK South": "uksouth",
      },
    };

    const parts: string[] = [];
    for (const q of awaitingClarification) {
      let answer = clarificationAnswers[q.id] || "";
      if (!answer) continue;
      const mapped = OPTION_TO_KEYWORD[q.id]?.[answer];
      if (mapped) {
        answer = mapped;
      }
      parts.push(`${q.id}: ${answer}`);
    }
    if (parts.length === 0) return;
    const formatted = parts.join(". ") + ".";
    clearClarifications();
    onSendMessage(formatted);
  }, [awaitingClarification, clarificationAnswers, clearClarifications, onSendMessage]);

  const handleValidationSubmit = useCallback(() => {
    if (!pendingValidationFixes) return;
    const apply: string[] = [];
    const skip: string[] = [];
    for (const fix of pendingValidationFixes) {
      const choice = validationFixChoices[fix.fix_id];
      if (choice === false) {
        skip.push(fix.fix_id);
      } else {
        apply.push(fix.fix_id);
      }
    }
    const parts: string[] = [];
    if (apply.length > 0) parts.push(`apply: ${apply.join(", ")}`);
    if (skip.length > 0) parts.push(`skip: ${skip.join(", ")}`);
    const formatted = parts.join(". ") + ".";
    clearValidationFixes();
    onSendMessage(formatted);
  }, [pendingValidationFixes, validationFixChoices, clearValidationFixes, onSendMessage]);

  const allAnswered =
    (awaitingClarification === null ||
      awaitingClarification.every((q) => (clarificationAnswers[q.id] || "").trim().length > 0)) &&
    (pendingValidationFixes === null ||
      pendingValidationFixes.every((f) => validationFixChoices[f.fix_id] !== undefined));

  return (
    <div className={`${className} flex flex-col bg-[#0B0B11]`}>
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${isConnected ? "bg-success" : "bg-muted"}`}
        />
        <span className="text-xs text-muted-foreground">
          {sessionId === null ? "Ready" : isConnected ? "Connected" : "Connecting..."}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
        {messages.length === 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest px-1">Try an example</p>
            <div className="space-y-2">
              {([
                { Icon: Cpu,    color: "#f59e0b", text: "Image processing pipeline for 10k images/min" },
                { Icon: Layers, color: "#8b5cf6", text: "RAG chatbot grounded in internal documents" },
                { Icon: Radio,  color: "#14b8a6", text: "IoT telemetry ingestion and analytics pipeline" },
              ] as const).map(({ Icon, color, text }) => (
                <button
                  key={text}
                  onClick={() => onSendMessage(text)}
                  className="w-full text-left flex items-start gap-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.16] rounded-xl px-3 py-3 transition-colors duration-150 group"
                >
                  <div className="mt-0.5 shrink-0 rounded-lg p-1.5" style={{ background: `${color}20` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                    {text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} onSendMessage={onSendMessage} onApplyOptimization={onApplyOptimization} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 relative">
        {awaitingClarification && (
          <button
            type="button"
            onClick={handleClarificationSubmit}
            disabled={!allAnswered}
            className="w-full mb-3 py-2.5 rounded-lg bg-gradient-to-r from-electric to-purple text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Submit Answers
          </button>
        )}
        {pendingValidationFixes && (
          <button
            type="button"
            onClick={handleValidationSubmit}
            disabled={!allAnswered}
            className="w-full mb-3 py-2.5 rounded-lg bg-gradient-to-r from-destructive to-orange-600 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Apply Selected Fixes
          </button>
        )}
        {/* Slash command menu */}
        {input.startsWith("/") && (() => {
          const trimmed = input.trim();
          const typed = trimmed.slice(1); // strip leading "/"

          // Exact command match with a space → show its args
          const exactKey = Object.keys(SLASH_COMMANDS).find((k) => trimmed === `/${k}` || trimmed.startsWith(`/${k} `));
          if (exactKey) {
            const def = SLASH_COMMANDS[exactKey];
            const Icon = def.icon;
            const hasArg = trimmed.length > exactKey.length + 2;
            if (hasArg || !def.args) return null;
            return (
              <div className="mb-2 rounded-lg border bg-[#111118] overflow-hidden" style={{ borderColor: `${def.color}40` }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b" style={{ borderColor: `${def.color}20` }}>
                  <Icon size={11} style={{ color: def.color }} />
                  <span className="text-[11px] font-semibold" style={{ color: def.color }}>/{exactKey}</span>
                  <span className="text-[11px] text-muted-foreground">— {def.description}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2">
                  {def.args.map((arg) => {
                    const ArgIcon = arg.icon;
                    return (
                      <button
                        key={arg.value}
                        type="button"
                        onClick={() => setInput(`/${exactKey} ${arg.value}`)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border border-white/10 bg-white/5 hover:bg-white/10 transition"
                        style={{ color: "#c4b5fd" }}
                      >
                        <ArgIcon size={10} />
                        {arg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Partial match — filter commands whose name starts with what's typed
          const matches = Object.entries(SLASH_COMMANDS).filter(([k]) => k.startsWith(typed));
          if (matches.length === 0) return null;
          return (
            <div className="mb-2 rounded-lg border border-white/10 bg-[#111118] overflow-hidden">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-b border-white/[0.06]">
                Commands
              </div>
              {matches.map(([cmd, def]) => {
                const Icon = def.icon;
                return (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => setInput(`/${cmd} `)}
                    className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-white/[0.04] transition"
                  >
                    <span className="flex items-center justify-center h-5 w-5 rounded" style={{ background: `${def.color}20` }}>
                      <Icon size={11} style={{ color: def.color }} />
                    </span>
                    <span className="text-xs font-semibold" style={{ color: def.color }}>/{cmd}</span>
                    <span className="text-[11px] text-muted-foreground">{def.description}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={awaitingClarification ? "Fill in the answers above to continue\u2026" : pendingValidationFixes ? "Choose which fixes to apply above\u2026" : "Describe what you want to build\u2026 or /simulate ddos"}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30 transition"
            disabled={isLoading || !!awaitingClarification || !!pendingValidationFixes}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !!awaitingClarification || !!pendingValidationFixes}
            className="p-2.5 rounded-lg bg-gradient-to-r from-electric to-purple hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
