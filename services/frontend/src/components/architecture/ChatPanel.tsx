import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Cpu, Layers, Radio } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";
import ChatMessage from "./ChatMessage";

export default function ChatPanel({
  className,
  onSendMessage,
}: {
  className?: string;
  onSendMessage: (msg: string) => void;
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
          <ChatMessage key={idx} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
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
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={awaitingClarification ? "Fill in the answers above to continue\u2026" : pendingValidationFixes ? "Choose which fixes to apply above\u2026" : "Describe what you want to build..."}
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
