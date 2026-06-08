import ReactFlow, {
  Background,
  Controls,
  MiniMap,
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
        className={`${className} flex items-center justify-center text-muted-foreground`}
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
    <div className={className}>
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
          className="glass rounded-md overflow-hidden"
          showInteractive={false}
        />
        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(10, 14, 26, 0.85)"
          className="glass rounded-md overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
}
