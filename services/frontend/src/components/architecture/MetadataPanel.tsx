import { AlertTriangle, Zap, BookOpen } from "lucide-react";
import { useArchitectureStore } from "../../stores/architectureStore";
import type { Service } from "../../types/architecture";

function buildExplanation(service: Service): string {
  const name = service.name || service.type;
  const cost = service.cost_estimate != null ? `$${service.cost_estimate}/month` : "variable cost";
  const region = service.region ? ` in ${service.region}` : "";
  const category = service.category ?? "Azure";
  const reasoning = service.reasoning
    ? service.reasoning.charAt(0).toLowerCase() + service.reasoning.slice(1)
    : "handle a critical part of this workload";

  const categoryContext: Record<string, string> = {
    Compute:    "It scales horizontally under load and is managed by Azure, eliminating infrastructure overhead.",
    Storage:    "It offers high durability (11 nines), geo-redundancy options, and integrates natively with other Azure services.",
    Messaging:  "It decouples producers and consumers, enabling asynchronous processing and peak-load buffering.",
    AI:         "It brings Azure's AI capabilities directly into the data path, reducing round-trips and operational complexity.",
    Networking: "It sits at the edge of the architecture, routing and load-balancing traffic before it reaches backend services.",
    Management: "It provides real-time observability, alerting, and diagnostics across the entire architecture.",
    Security:   "It centralizes secrets and access policies, enforcing zero-trust principles without spreading credentials across services.",
    Database:   "It provides persistent, queryable storage with automatic indexing, backups, and optional geo-replication.",
  };

  const ctx = categoryContext[category] ?? "It is a managed Azure service with built-in SLAs and seamless integration with the rest of the stack.";

  return `**${name}** is selected here to ${reasoning}. Deployed${region} with an estimated cost of ${cost}, it falls under the ${category} category. ${ctx} This service is a deliberate architectural choice — swapping it out would require revisiting the connections and contracts with its downstream dependencies.`;
}

const IMPACT_COLORS: Record<string, { text: string; bg: string; border: string; label: string }> = {
  failed:         { text: "#ef4444", bg: "bg-red-500/10",    border: "border-red-500/30",    label: "Failed"         },
  direct_failure: { text: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/30", label: "Direct Failure" },
  degraded:       { text: "#f59e0b", bg: "bg-amber-500/10",  border: "border-amber-500/30",  label: "Degraded"       },
  delayed_impact: { text: "#eab308", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "At Risk"        },
};

export default function MetadataPanel({
  className,
  onRevalidate,
  onSimulateFailure,
}: {
  className?: string;
  onRevalidate?: () => void;
  onSimulateFailure?: () => void;
}) {
  const architecture = useArchitectureStore((s) => s.architecture);
  const selectedNodeId = useArchitectureStore((s) => s.selectedNodeId);
  const failureSimResult = useArchitectureStore((s) => s.failureSimResult);
  const clearFailureSim = useArchitectureStore((s) => s.clearFailureSim);
  const addMessage = useArchitectureStore((s) => s.addMessage);

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

    // Find this service's impact in a running simulation
    const simImpact = failureSimResult
      ? failureSimResult.failed_service_id === selectedService.id
        ? { severity: "failed", reason: "This is the failed service" }
        : failureSimResult.impacted.find((i) => i.id === selectedService.id)
      : null;

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
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reasoning</div>
              <button
                onClick={() => addMessage({
                  role: "assistant",
                  type: "reasoning",
                  content: buildExplanation(selectedService),
                })}
                className="flex items-center gap-1 text-[10px] font-medium text-electric/70 hover:text-electric transition px-2 py-0.5 rounded border border-electric/20 hover:border-electric/40 hover:bg-electric/5"
              >
                <BookOpen size={10} />
                Explain
              </button>
            </div>
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

        {/* Failure sim impact for this service */}
        {simImpact && (
          <div className={`rounded-lg border p-3 ${IMPACT_COLORS[simImpact.severity]?.bg ?? "bg-red-500/10"} ${IMPACT_COLORS[simImpact.severity]?.border ?? "border-red-500/30"}`}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: IMPACT_COLORS[simImpact.severity]?.text }}>
              {IMPACT_COLORS[simImpact.severity]?.label ?? simImpact.severity}
            </div>
            <p className="text-xs text-muted-foreground">{simImpact.reason}</p>
          </div>
        )}

        {/* Simulate Failure / Clear Simulation buttons */}
        {failureSimResult ? (
          <button
            onClick={clearFailureSim}
            className="w-full py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-400 hover:bg-red-500/20 transition"
          >
            Clear Simulation
          </button>
        ) : (
          <button
            onClick={onSimulateFailure}
            className="w-full py-2 rounded-lg border border-red-500/20 bg-red-500/8 text-sm font-medium text-red-400/80 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/15 transition flex items-center justify-center gap-2"
          >
            <Zap size={14} />
            Simulate Failure
          </button>
        )}
      </div>
    );
  }

  // Architecture-level metadata view
  const { metadata, warnings } = architecture;
  const iteration = metadata?.iteration;

  return (
    <div className={`${className} p-4 space-y-4 overflow-y-auto`}>
      {/* Failure sim summary banner */}
      {failureSimResult && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Failure Simulation</span>
            <button onClick={clearFailureSim} className="text-[10px] text-red-400/60 hover:text-red-400 transition">Clear</button>
          </div>
          <p className="text-xs text-red-300 font-medium">{failureSimResult.failed_service_name} failed</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{failureSimResult.summary}</p>
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {(["full_outage", "partial_outage", "degraded"] as const).includes(failureSimResult.overall_status as any) && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                failureSimResult.overall_status === "full_outage" ? "bg-red-500/20 text-red-400" :
                failureSimResult.overall_status === "partial_outage" ? "bg-orange-500/20 text-orange-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {failureSimResult.overall_status.replace("_", " ")}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
              {failureSimResult.unaffected_count} unaffected
            </span>
          </div>
        </div>
      )}

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
