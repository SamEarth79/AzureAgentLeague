import { useState } from "react";
import type { ClarificationQuestion } from "../../types/architecture";
import { useArchitectureStore } from "../../stores/architectureStore";

export default function ClarificationCard({
  question,
  frozen,
}: {
  question: ClarificationQuestion;
  frozen: boolean;
}) {
  const storedAnswer = useArchitectureStore((s) => s.clarificationAnswers[question.id]);
  const setAnswer = useArchitectureStore((s) => s.setClarificationAnswer);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");

  const handleChipClick = (option: string) => {
    if (frozen) return;
    const newChip = selectedChip === option ? null : option;
    setSelectedChip(newChip);
    setFreeText("");
    setAnswer(question.id, newChip || "");
  };

  const handleFreeTextChange = (val: string) => {
    if (frozen) return;
    setFreeText(val);
    setSelectedChip(null);
    setAnswer(question.id, val);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-3">
      <p className="text-sm font-medium text-foreground">{question.question}</p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((opt) => {
          const active = selectedChip === opt;
          return (
            <button
              key={opt}
              onClick={() => handleChipClick(opt)}
              disabled={frozen}
              className={`rounded-full border px-3 py-1 text-[11px] transition ${
                active
                  ? "border-electric bg-electric/15 text-electric"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              } ${frozen ? "opacity-60 pointer-events-none" : ""}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <textarea
        value={freeText}
        onChange={(e) => handleFreeTextChange(e.target.value)}
        placeholder="Or describe in your own words\u2026"
        rows={2}
        disabled={frozen}
        className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-electric/50 disabled:opacity-50"
      />
    </div>
  );
}
