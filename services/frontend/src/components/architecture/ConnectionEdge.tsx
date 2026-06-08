import { getBezierPath, EdgeProps } from "reactflow";

const TYPE_COLORS: Record<string, string> = {
  "event-driven": "#8b5cf6",
  async:          "#f59e0b",
  sync:           "#00d4ff",
};

export default function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const connType = data?.type || "sync";
  const color = TYPE_COLORS[connType] || TYPE_COLORS["sync"];
  const isDashed = connType !== "sync";

  return (
    <g>
      {/* Glow layer */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeOpacity={0.15}
        strokeDasharray={isDashed ? "6 4" : undefined}
      />
      {/* Main line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.8}
        strokeDasharray={isDashed ? "6 4" : undefined}
      />
    </g>
  );
}
