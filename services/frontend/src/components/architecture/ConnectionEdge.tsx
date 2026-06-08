import { BaseEdge, EdgeLabelRenderer, getBezierPath, EdgeProps } from "reactflow";

export default function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: "#60a5fa", strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          className="text-[10px] bg-electric/20 text-electric px-2 py-0.5 rounded border border-electric/30 pointer-events-none"
        >
          {data?.protocol || data?.type || "connects"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
