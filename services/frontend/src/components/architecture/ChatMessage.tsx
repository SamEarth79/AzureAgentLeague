import type { Message } from "../../types/architecture";

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const bgColor = isUser
    ? "bg-electric/10 border border-electric/20"
    : "bg-white/5 border border-white/10";
  const textColor =
    message.type === "warning"
      ? "text-warning"
      : message.type === "tool_call"
        ? "text-purple"
        : "text-foreground";

  return (
    <div className={`${bgColor} rounded-lg p-3 ${textColor}`}>
      {message.step && (
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
          {message.step}
        </div>
      )}
      {message.type === "architecture" && message.data ? (
        <div className="text-sm">
          <div className="text-success font-medium mb-1">✓ Architecture generated</div>
          <div className="text-muted-foreground">
            {message.data.services?.length || 0} services,{" "}
            {message.data.connections?.length || 0} connections
          </div>
          {message.data.metadata?.estimated_cost_monthly && (
            <div className="text-success mt-1">
              Est. ${message.data.metadata.estimated_cost_monthly}/mo
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      )}
      {message.type === "tool_call" && message.data && (
        <pre className="text-xs mt-2 bg-black/20 p-2 rounded overflow-x-auto">
          {JSON.stringify(message.data, null, 2)}
        </pre>
      )}
      {message.type === "complete" && (
        <div className="flex items-center gap-2 text-sm text-success">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
          Ready for review
        </div>
      )}
    </div>
  );
}
