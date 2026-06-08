interface CanvasNode {
  id: string;
  label: string;
  x: number;
  y: number;
  cost: string;
  color: string;
}

const nodes: CanvasNode[] = [
  { id: "fn", label: "Functions", x: 30, y: 30, cost: "$42", color: "from-electric to-electric-soft" },
  { id: "blob", label: "Blob Storage", x: 200, y: 110, cost: "$18", color: "from-purple to-purple-soft" },
  { id: "evt", label: "Event Grid", x: 90, y: 200, cost: "$7", color: "from-electric to-purple" },
  { id: "cdb", label: "Cosmos DB", x: 260, y: 230, cost: "$180", color: "from-purple to-electric" },
];

const edges = [
  "M 90 70 C 150 70, 180 100, 240 130",
  "M 90 70 C 100 130, 110 160, 130 220",
  "M 240 150 C 260 200, 280 220, 300 240",
  "M 150 230 C 200 230, 250 240, 300 250",
];

export function CanvasMock() {
  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-purple/60 via-electric/40 to-transparent shadow-[0_30px_80px_-30px_rgba(59,130,246,0.6)]">
      <div className="rounded-2xl glass-strong p-4 h-[380px] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 320">
          <defs>
            <linearGradient id="edge" x1="0" x2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <filter id="edgeGlow">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>
          {edges.map((d, i) => (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="url(#edge)"
                strokeWidth="2"
                opacity="0.5"
                filter="url(#edgeGlow)"
              />
              <path
                d={d}
                fill="none"
                stroke="url(#edge)"
                strokeWidth="1.5"
                className="animate-dash"
              />
            </g>
          ))}
        </svg>

        {nodes.map((n, i) => (
          <div
            key={n.id}
            className="absolute animate-fade-up"
            style={{ left: n.x, top: n.y, animationDelay: `${i * 150}ms` }}
          >
            <div
              className={`relative rounded-xl px-3 py-2.5 bg-gradient-to-br ${n.color} shadow-[0_0_30px_-4px_rgba(96,165,250,0.7)] min-w-[120px]`}
            >
              <div className="text-[10px] uppercase tracking-widest text-white/80">Azure</div>
              <div className="text-sm font-semibold text-white">{n.label}</div>
              <div className="absolute -top-2 -right-2 glass text-[10px] px-1.5 py-0.5 rounded-md text-electric-soft border border-electric/40">
                {n.cost}/mo
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-3 right-3 glass rounded-md p-1.5 w-24 h-16">
          <div className="w-full h-full rounded bg-gradient-to-br from-electric/30 to-purple/30 relative">
            <div className="absolute inset-1 border border-electric/60 rounded-sm" />
          </div>
        </div>

        <div className="absolute bottom-3 left-3 glass rounded-md flex flex-col text-foreground/80 text-xs">
          <button className="px-2 py-1 hover:text-electric">+</button>
          <button className="px-2 py-1 border-t border-white/10 hover:text-electric">−</button>
        </div>
      </div>
    </div>
  );
}
