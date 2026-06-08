import { useArchitectureStore } from "../../stores/architectureStore";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export default function ReasoningTimeline({ className }: { className?: string }) {
  const messages = useArchitectureStore((s) => s.messages);

  const steps = messages
    .filter((m) => m.type === "reasoning" && m.step)
    .map((m) => ({ step: m.step, complete: true }))
    .filter((s, i, arr) => arr.findIndex((x) => x.step === s.step) === i);

  const allSteps = [
    { id: "parsing", label: "Parse" },
    { id: "querying", label: "Query" },
    { id: "reasoning", label: "Reason" },
    { id: "validating", label: "Validate" },
    { id: "estimating", label: "Estimate" },
    { id: "complete", label: "Complete" },
  ];

  const currentStep = steps[steps.length - 1]?.step || null;

  return (
    <div className={`${className} p-3 overflow-x-auto`}>
      <div className="flex items-center gap-2 min-w-max">
        {allSteps.map((step, idx) => {
          const isDone = steps.find((s) => s.step === step.id);
          const isCurrent = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  isDone
                    ? "bg-success/20 text-success"
                    : isCurrent
                      ? "bg-electric/20 text-electric"
                      : "bg-white/5 text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 size={14} />
                ) : isCurrent ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Circle size={14} />
                )}
                <span className="capitalize">{step.label}</span>
              </div>
              {idx < allSteps.length - 1 && (
                <div className="w-6 h-px bg-white/10 mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
