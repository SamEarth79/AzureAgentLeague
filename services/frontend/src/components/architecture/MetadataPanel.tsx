import { DollarSign, AlertTriangle, MapPin } from "lucide-react";
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
    const iteration = architecture.metadata?.iteration;

    return (
      <div className={`${className} p-4 space-y-3 overflow-y-auto`}>
        <h3 className="font-semibold text-sm text-foreground">{selectedService.name}</h3>
        <div className="text-xs text-muted-foreground mb-2">{selectedService.type}</div>

        {iteration != null && iteration > 0 && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1">
            Self-correction iteration: {iteration}/3
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign size={16} className="text-success" />
            <span className="text-foreground">
              {selectedService.cost_estimate != null
                ? `$${selectedService.cost_estimate}/mo`
                : "Cost N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} className="text-electric" />
            <span className="text-foreground">{selectedService.region || "No region set"}</span>
          </div>
        </div>

        {selectedService.reasoning && (
          <div className="text-xs bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="font-semibold text-foreground mb-1">Reasoning</div>
            <div className="text-muted-foreground">{selectedService.reasoning}</div>
          </div>
        )}

        {selectedService.foundry_iq_confidence != null && (
          <div className="text-xs text-muted-foreground">
            Foundry IQ confidence: {Math.round(selectedService.foundry_iq_confidence * 100)}%
          </div>
        )}

        {selectedService.foundry_iq_docs_link && (
          <a
            href={selectedService.foundry_iq_docs_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-electric hover:underline block"
          >
            View Azure Docs →
          </a>
        )}

        {selectedService.config && (
          <div>
            <div className="text-xs font-semibold text-foreground mb-1">Configuration</div>
            <pre className="text-xs bg-black/30 p-2.5 rounded-lg overflow-x-auto text-muted-foreground border border-white/10">
              {JSON.stringify(selectedService.config, null, 2)}
            </pre>
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
        <h3 className="font-semibold text-sm text-foreground mb-3">Architecture Summary</h3>

        {iteration != null && iteration > 0 && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded px-2 py-1 mb-3">
            Self-correction iteration: {iteration}/3
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Services</span>
            <span className="text-foreground font-medium">
              {architecture.services.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Connections</span>
            <span className="text-foreground font-medium">
              {architecture.connections.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. Cost</span>
            <span className="text-success font-medium">
              ${metadata?.estimated_cost_monthly || "—"}/mo
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Latency p95</span>
            <span className="text-foreground">
              {metadata?.estimated_latency_p95 || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Throughput</span>
            <span className="text-foreground">
              {metadata?.estimated_throughput || "—"}
            </span>
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
