import { useState, useRef, useEffect } from "react";
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
  const [sending, setSending] = useState(false);
  const messages = useArchitectureStore((s) => s.messages);
  const sessionId = useArchitectureStore((s) => s.sessionId);
  const isConnected = useArchitectureStore((s) => s.isConnected);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Re-enable input once connection is established
  useEffect(() => {
    if (isConnected) setSending(false);
  }, [isConnected]);

  const canSend = sessionId === null || isConnected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canSend) return;
    setSending(true);
    await onSendMessage(input);
    setInput("");
  };

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
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to build..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30 transition"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-lg bg-gradient-to-r from-electric to-purple hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
