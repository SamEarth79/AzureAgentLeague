import { AlertTriangle } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";

export default function MetadataPanel({
  className,
  onRevalidate,
}: {
  className?: string;
  onRevalidate?: () => void;
}) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedNodeId = useArchitectureStore((s) => s.selectedNodeId);

  if (!architecture) {
    return (
      <div className={`${className} p-4 text-muted-foreground text-sm flex items-center justify-center`}>
        No architecture yet
      </div>
    );
  }

  const selectedService = architecture.services.find((s) => s.id === selectedNodeId);

  if (selectedService) {
    const configEntries = selectedService.config ? Object.entries(selectedService.config) : [];

    return (
      <div className={`${className} p-4 space-y-3 overflow-y-auto scrollbar-hide`}>
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {selectedService.name}
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Monthly Cost</div>
              <div className="text-xl font-bold text-[#f59e0b]">
                {selectedService.cost_estimate != null ? `$${selectedService.cost_estimate}` : "—"}
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Region</div>
              <div className="text-xl font-bold text-foreground">
                {selectedService.region || "—"}
              </div>
            </div>
            <div className="col-span-2 bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Service Type</div>
              <div className="text-sm font-semibold text-foreground">{selectedService.type}</div>
            </div>
          </div>
        </div>

        {selectedService.reasoning && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Reasoning</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{selectedService.reasoning}</p>
          </div>
        )}

        {configEntries.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {configEntries.map(([key, val]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{key}</div>
                <div className="text-sm font-semibold text-foreground truncate">{String(val)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show architecture-level metadata
  const { metadata, warnings } = architecture;
  const iteration = metadata?.iteration;

  return (
    <div className={`${className} p-4 space-y-4 overflow-y-auto`}>
      <div>
        <h3 className="text-[20px] font-bold uppercase tracking-widest mb-3">Architecture Metadata</h3>

        {iteration != null && iteration > 0 && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1 mb-3">
            Self-correction iteration: {iteration}/3
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Monthly Cost</div>
            <div className="text-xl font-bold text-[#f59e0b]">
              ${metadata?.estimated_cost_monthly || "—"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">P95 Latency</div>
            <div className="text-xl font-bold text-[#f59e0b]">
              {metadata?.estimated_latency_p95 || "—"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Throughput</div>
            <div className="text-xl font-bold text-foreground">
              {metadata?.estimated_throughput || "—"}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Regions</div>
            <div className="text-xl font-bold text-foreground">
              {metadata?.regions?.length ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle size={16} className="text-warning" />
            Warnings ({warnings.length})
          </h3>
          <div className="space-y-2">
            {warnings.map((w, idx) => (
              <div
                key={idx}
                className={`text-xs p-2.5 rounded-lg border ${
                  w.severity === "high"
                    ? "border-destructive/30 bg-destructive/10"
                    : w.severity === "medium"
                      ? "border-warning/30 bg-warning/10"
                      : "border-white/10 bg-white/5"
                }`}
              >
                <div className="font-medium text-foreground">{w.message}</div>
                {w.suggested_fix && (
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    Fix: {w.suggested_fix}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onRevalidate}
        className="w-full py-2.5 bg-gradient-to-r from-electric to-purple hover:opacity-90 rounded-lg text-sm font-medium transition"
      >
        Re-validate Architecture
      </button>
    </div>
  );
}
