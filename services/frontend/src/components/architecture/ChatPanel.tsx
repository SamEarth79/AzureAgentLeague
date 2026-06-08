import { useState, useRef, useEffect } from "react";
import { Send, Loader2, List } from "lucide-react";
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
  const detailLevel = useArchitectureStore((s) => s.detailLevel);
  const setDetailLevel = useArchitectureStore((s) => s.setDetailLevel);
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
    <div className={`${className} flex flex-col bg-background/80`}>
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">Reasoning</h2>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-success" : "bg-muted"
              }`}
            />
            <span className="text-muted-foreground">
              {sessionId === null ? "Ready" : isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>
        <div className="relative">
          <select
            value={detailLevel}
            onChange={(e) =>
              setDetailLevel(e.target.value as "simple" | "detailed" | "expert")
            }
            className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-muted-foreground focus:outline-none focus:border-electric appearance-none pr-6"
          >
            <option value="simple">Simple</option>
            <option value="detailed">Detailed</option>
            <option value="expert">Expert</option>
          </select>
          <List
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <p>Describe your architecture needs</p>
            <p className="text-xs mt-1">e.g. "Image processing pipeline for 10k images/min"</p>
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
