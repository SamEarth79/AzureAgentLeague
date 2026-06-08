import { Link } from "react-router-dom";
import { Brain, ArrowLeft, Zap } from "lucide-react";
import { ReactFlowProvider } from "reactflow";
import { useArchitectureStore } from "../stores/architectureStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { useSession } from "../hooks/useSession";
import Canvas from "../components/architecture/Canvas";
import ChatPanel from "../components/architecture/ChatPanel";
import NodePicker from "../components/architecture/NodePicker";
import MetadataPanel from "../components/architecture/MetadataPanel";
import ReasoningTimeline from "../components/architecture/ReasoningTimeline";

export default function Architecture() {
  const sessionId = useArchitectureStore((s) => s.sessionId);
  const setPendingMessage = useArchitectureStore((s) => s.setPendingMessage);
  const { sendMessage } = useWebSocket(sessionId);
  const { startSession } = useSession();

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      setPendingMessage(content);
      await startSession(content);
      return;
    }
    sendMessage(content);
  };

  const handleRevalidate = () => {
    if (sessionId) {
      sendMessage("Re-validate this architecture");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 glass-strong border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft size={16} />
            <span className="h-6 w-6 rounded-md bg-gradient-to-br from-electric to-purple grid place-items-center">
              <Brain size={12} className="text-white" />
            </span>
            <span className="font-display font-bold text-sm text-foreground">ArchMind</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            Built with React + React Flow + LangGraph + Azure Foundry
          </span>
          <Zap size={14} className="text-electric-soft" />
        </div>
      </header>

      {/* Main: Chat (25%) + Canvas (75%) */}
      <div className="flex-1 flex overflow-hidden">
        <ChatPanel className="w-[280px] shrink-0" onSendMessage={handleSendMessage} />
        <ReactFlowProvider>
          <Canvas className="flex-1" />
        </ReactFlowProvider>
      </div>

      {/* Timeline */}
      <ReasoningTimeline className="h-10 border-y border-white/10 shrink-0" />

      {/* Bottom: Node Picker (60%) + Metadata (40%) */}
      <div className="h-56 flex border-t border-white/10 shrink-0">
        <NodePicker className="w-[60%]" />
        <div className="w-px bg-white/10" />
        <MetadataPanel className="w-[40%]" onRevalidate={handleRevalidate} />
      </div>
    </div>
  );
}
