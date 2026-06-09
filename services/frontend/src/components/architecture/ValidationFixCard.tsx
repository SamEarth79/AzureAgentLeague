import { useArchitectureStore } from "../../stores/architectureStore";
import type { ValidationFixProposal } from "../../types/architecture";

export default function ValidationFixCard({
  fix,
  frozen,
}: {
  fix: ValidationFixProposal;
  frozen: boolean;
}) {
  const choice = useArchitectureStore((s) => s.validationFixChoices[fix.fix_id]);
  const setChoice = useArchitectureStore((s) => s.setValidationFixChoice);
  const apply = choice ?? true;

  const handleApply = () => {
    if (!frozen) setChoice(fix.fix_id, true);
  };

  const handleSkip = () => {
    if (!frozen) setChoice(fix.fix_id, false);
  };

  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-3.5 space-y-2.5">
      <div className="flex items-start gap-2">
        <span className="text-destructive text-sm mt-0.5 shrink-0">⚠</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{fix.warning_message}</p>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
        <p className="text-[11px] text-muted-foreground/60 font-semibold uppercase tracking-wider mb-0.5">
          Suggested Fix
        </p>
        <p className="text-[12.5px] text-foreground/80">{fix.suggested_fix}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={frozen}
          className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
            apply
              ? "border-success bg-success/15 text-success"
              : "border-white/10 text-muted-foreground hover:border-white/20"
          } ${frozen ? "opacity-60 pointer-events-none" : ""}`}
        >
          Apply Fix
        </button>
        <button
          onClick={handleSkip}
          disabled={frozen}
          className={`flex-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
            !apply
              ? "border-muted-foreground/40 bg-white/10 text-foreground"
              : "border-white/10 text-muted-foreground hover:border-white/20"
          } ${frozen ? "opacity-60 pointer-events-none" : ""}`}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
