import { AlertTriangle, MapPin, Download } from "lucide-react";

export function MetadataMock() {
  return (
    <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-electric/60 via-success/30 to-purple/50 shadow-[0_30px_80px_-30px_rgba(16,185,129,0.4)]">
      <div className="rounded-2xl glass-strong p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Monthly estimate
            </div>
            <div className="font-display text-4xl font-bold text-gradient">
              $247<span className="text-lg text-muted-foreground">/mo</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              32ms latency p95 · 99.95% SLA
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-success">under budget</div>
            <div className="text-sm text-foreground/80">$500 cap</div>
          </div>
        </div>

        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-[49%] bg-gradient-to-r from-electric to-purple rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Throughput
            </div>
            <div className="text-foreground font-semibold">12k req/s</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cold start
            </div>
            <div className="text-foreground font-semibold">340ms</div>
          </div>
        </div>

        <div className="space-y-2">
          <WarningCard
            severity="high"
            text="Cosmos DB single-region — add geo-replication"
          />
          <WarningCard severity="medium" text="Function timeout near limit at 8m" />
        </div>

        <div className="glass rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-foreground/80">
            <MapPin size={14} className="text-electric" /> East US 2 · West Europe
          </div>
          <button className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-electric/15 text-electric-soft border border-electric/30 hover:bg-electric/25 transition">
            <Download size={12} /> Export
          </button>
        </div>
      </div>
    </div>
  );
}

function WarningCard({ severity, text }: { severity: "high" | "medium"; text: string }) {
  const styles =
    severity === "high"
      ? "bg-destructive/15 border-destructive/40 text-destructive"
      : "bg-warning/15 border-warning/40 text-warning";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${styles}`}
    >
      <AlertTriangle size={14} />
      <span className="uppercase tracking-wider font-semibold">{severity}</span>
      <span className="text-foreground/85 normal-case">· {text}</span>
    </div>
  );
}
