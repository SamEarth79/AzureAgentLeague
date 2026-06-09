import { useMemo, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  type NodeChange,
  useReactFlow,
  type Connection as RFConnection,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { FileJson, FileImage, X } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";
import { getLayoutedElements } from "../../lib/layoutEngine";
import { SERVICE_CATALOG } from "../../lib/serviceCatalog";
import { inferEdgeType } from "../../lib/connectionRules";
import ServiceNode from "./ServiceNode";
import ConnectionEdge from "./ConnectionEdge";
import type { Service, Connection } from "../../types/architecture";

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { connectionEdge: ConnectionEdge };

export default function Canvas({ className }: { className?: string }) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const updatePosition = useArchitectureStore((s) => s.updateServicePosition);
  const setSelectedNode = useArchitectureStore((s) => s.setSelectedNode);
  const addServiceManually = useArchitectureStore((s) => s.addServiceManually);
  const addConnectionManually = useArchitectureStore((s) => s.addConnectionManually);
  const services = useArchitectureStore((s) => s.architecture?.services);
  const connections = useArchitectureStore((s) => s.architecture?.connections);

  const failureSimResult = useArchitectureStore((s) => s.failureSimResult);
  const clearFailureSim = useArchitectureStore((s) => s.clearFailureSim);

  const instance = useReactFlow();
  const rfWrapperRef = useRef<HTMLDivElement>(null);
  const hasContent = architecture && architecture.services.length > 0;
  const serviceIds = architecture?.services.map((s) => s.id).join(",") ?? "";

  useEffect(() => {
    if (!hasContent) return;
    const t = setTimeout(() => {
      instance.fitView({ padding: 0.3, duration: 400 });
    }, 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds]);

  const exportJSON = useCallback(() => {
    if (!architecture) return;
    const blob = new Blob([JSON.stringify(architecture, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [architecture]);

  const exportPNG = useCallback(async () => {
    if (!rfWrapperRef.current) return;
    try {
      const dataUrl = await toPng(rfWrapperRef.current, {
        backgroundColor: "#151415",
        pixelRatio: 2,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "architecture.png";
      a.click();
    } catch {
      // ignore export errors
    }
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!hasContent) return { nodes: [], edges: [] };
    const result = getLayoutedElements(architecture.services, architecture.connections);

    if (failureSimResult) {
      const impactMap = new Map<string, string>([
        [failureSimResult.failed_service_id, "failed"],
        ...failureSimResult.impacted.map((i) => [i.id, i.severity] as [string, string]),
      ]);
      result.nodes = result.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          failureImpact: impactMap.get(n.id) ?? "unaffected",
        },
      }));
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(architecture?.services.map((s) => ({
      id: s.id,
      x: s.position?.x ?? null,
      y: s.position?.y ?? null,
    }))),
    JSON.stringify(architecture?.connections.map((c) => c.id)),
    failureSimResult,
  ]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const catalogEntry = JSON.parse(raw);
      const catalogMatch = SERVICE_CATALOG.find((c) => c.id === catalogEntry.id);
      const cost = catalogMatch?.default_cost_estimate ?? 0;

      const position = instance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const service: Service = {
        id: crypto.randomUUID(),
        name: catalogEntry.name,
        type: catalogEntry.type,
        category: catalogEntry.category,
        description: catalogEntry.description,
        icon: catalogEntry.icon,
        cost_estimate: cost,
        position,
      };

      addServiceManually(service);
    } catch {
      // ignore malformed drag payload
    }
  };

  const onConnect = (rfConn: RFConnection) => {
    if (!rfConn.source || !rfConn.target) return;
    if (!services || !connections) return;
    const sourceService = services.find((s) => s.id === rfConn.source);
    const targetService = services.find((s) => s.id === rfConn.target);
    if (!sourceService || !targetService) return;

    const edgeType = inferEdgeType(sourceService.category, targetService.category);

    const conn: Connection = {
      id: `conn-${crypto.randomUUID()}`,
      source_id: rfConn.source,
      target_id: rfConn.target,
      type: edgeType,
      protocol: edgeType,
    };

    addConnectionManually(conn);
  };

  // Update store positions on every change (including mid-drag).
  // ReactFlow needs position updates applied in controlled mode for
  // dragging to work.  Zustand is fast enough for this — React 18's
  // automatic batching collapses the resulting re-renders.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          updatePosition(change.id, change.position.x, change.position.y);
        }
      });
    },
    [updatePosition],
  );

  return (
    <div className={className} style={{ background: "#151415" }}>
      {!hasContent && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/40 z-10 pointer-events-none">
          Drop Azure services from the panel below onto the canvas
        </p>
      )}

      {failureSimResult && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-sm px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400 font-medium">
            Simulating failure of <span className="font-bold">{failureSimResult.failed_service_name}</span>
            {" — "}{failureSimResult.summary}
          </span>
          <button
            onClick={clearFailureSim}
            className="ml-1 rounded p-0.5 text-red-400/60 hover:text-red-400 transition"
          >
            <X size={13} />
          </button>
        </div>
      )}

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

      {/* Export */}
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        <button
          onClick={exportJSON}
          disabled={!hasContent}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111118]/90 backdrop-blur-sm px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-white/20 transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <FileJson size={14} />
          JSON
        </button>
        <button
          onClick={exportPNG}
          disabled={!hasContent}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#111118]/90 backdrop-blur-sm px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-white/20 transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <FileImage size={14} />
          PNG
        </button>
      </div>

      <div ref={rfWrapperRef} style={{ width: "100%", height: "100%" }}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onPaneClick={() => setSelectedNode(null)}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodesDraggable={true}
        fitView={!!hasContent}
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
    </div>
  );
}
