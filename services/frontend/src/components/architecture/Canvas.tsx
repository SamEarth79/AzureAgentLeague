import ReactFlow, {
  Background,
  Controls,
  NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { Brain } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";
import { getLayoutedElements } from "../../lib/layoutEngine";
import ServiceNode from "./ServiceNode";
import ConnectionEdge from "./ConnectionEdge";

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { connectionEdge: ConnectionEdge };

export default function Canvas({ className }: { className?: string }) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const updatePosition = useArchitectureStore((s) => s.updateServicePosition);
  const setSelectedNode = useArchitectureStore((s) => s.setSelectedNode);

  if (!architecture || architecture.services.length === 0) {
    return (
      <div
        className={`${className} flex items-center justify-center text-muted-foreground bg-[#151415]`}
      >
        <div className="text-center">
          <Brain size={64} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-display font-semibold">No architecture yet</p>
          <p className="text-sm mt-2">Type a prompt to start building</p>
        </div>
      </div>
    );
  }

  const { nodes, edges } = getLayoutedElements(
    architecture.services,
    architecture.connections
  );

  const handleNodesChange = (changes: NodeChange[]) => {
    changes.forEach((change) => {
      if (change.type === "position" && change.position && change.dragging === false) {
        updatePosition(change.id, change.position.x, change.position.y);
      }
    });
  };

  const handleNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node.id);
  };

  return (
    <div className={`${className} relative`} style={{ background: "#151415" }}>
      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 rounded-xl border border-white/[0.08] bg-[#111118]/90 backdrop-blur-sm px-3 py-2.5 space-y-2.5 pointer-events-none">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Edges</p>
          <div className="space-y-1">
            {[
              { color: "#00d4ff", label: "Sync",         dash: false },
              { color: "#f59e0b", label: "Async",        dash: true  },
              { color: "#8b5cf6", label: "Event-driven", dash: true  },
            ].map(({ color, label, dash }) => (
              <div key={label} className="flex items-center gap-2">
                <svg width="20" height="8">
                  <line
                    x1="0" y1="4" x2="20" y2="4"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray={dash ? "4 3" : undefined}
                  />
                </svg>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Nodes</p>
          <div className="space-y-1">
            {[
              { color: "#f59e0b", label: "Compute"    },
              { color: "#14b8a6", label: "Storage"    },
              { color: "#ef4444", label: "Messaging"  },
              { color: "#8b5cf6", label: "AI"         },
              { color: "#00d4ff", label: "Networking" },
              { color: "#6366f1", label: "Database"   },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2.5}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: "#60a5fa", strokeWidth: 2 },
        }}
      >
        <Background color="#ffffff15" gap={24} size={1} />
        <Controls
          position="bottom-right"
          className="glass rounded-md overflow-hidden"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
