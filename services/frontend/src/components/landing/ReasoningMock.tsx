import type { ReactNode } from "react";

export function ReasoningMock() {
  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-electric/60 via-purple/40 to-transparent shadow-[0_30px_80px_-30px_rgba(99,102,241,0.6)]">
      <div className="rounded-2xl glass-strong p-5 font-mono text-[13px] leading-relaxed">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            reasoning · live
          </span>
        </div>

        <div className="space-y-3">
          <Line color="text-electric" label="parse">
            Parsing: "image processing pipeline, ~10k files/day"
          </Line>
          <Line color="text-purple" label="query">
            Foundry IQ → <span className="text-electric-soft">azure.functions.consumption</span>
            <span className="text-muted-foreground"> // cold-start tradeoff</span>
          </Line>
          <Line color="text-warning" label="decide">
            Choosing <span className="text-foreground">Blob Storage</span> over Files (cost ↓ 64%)
          </Line>
          <div className="rounded-lg gradient-border p-3 ml-6 relative overflow-hidden">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
              Tradeoff card
            </div>
            <div className="text-foreground/90">
              Event Grid vs Storage Queues → <span className="text-electric">Event Grid</span>{" "}
              wins for fan-out
            </div>
          </div>
          <Line color="text-success" label="verify">
            No single points of failure detected ✓
          </Line>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider bg-electric/15 text-electric-soft border border-electric/30">
          <span className="h-1.5 w-1.5 rounded-full bg-electric animate-pulse-glow" />
          Foundry IQ Query
        </div>
      </div>
    </div>
  );
}

function Line({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={`${color} font-semibold w-14 shrink-0 text-[11px] uppercase tracking-wider mt-0.5`}
      >
        {label}
      </span>
      <span className="text-foreground/85">{children}</span>
    </div>
  );
}
