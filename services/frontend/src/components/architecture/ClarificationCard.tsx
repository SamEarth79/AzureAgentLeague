import { useState, useEffect, useCallback } from "react";
import type { ClarificationQuestion } from "../../types/architecture";
import { useArchitectureStore } from "../../stores/architectureStore";

function QuestionStep({
  question,
  frozen,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
}: {
  question: ClarificationQuestion;
  frozen: boolean;
  stepIndex: number;
  totalSteps: number;
  onNext: (questionId: string, answer: string) => void;
  onBack: () => void;
}) {
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");
  const [typingCustom, setTypingCustom] = useState(false);

  const options = question.options;
  const allOptions = [...options, "Type something"];

  const confirm = useCallback(
    (idx: number, text?: string) => {
      if (frozen) return;
      const answer = idx === options.length ? (text ?? customText) : options[idx];
      setSelectedIdx(idx);
      if (idx !== options.length) setTypingCustom(false);
      onNext(question.id, answer);
    },
    [frozen, options, customText, question.id, onNext]
  );

  const select = useCallback(
    (idx: number) => {
      if (frozen) return;
      setFocusedIdx(idx);
      if (idx === options.length) {
        setSelectedIdx(idx);
        setTypingCustom(true);
      } else {
        confirm(idx);
      }
    },
    [frozen, options.length, confirm]
  );

  useEffect(() => {
    if (frozen) return;
    const handler = (e: KeyboardEvent) => {
      if (typingCustom) return;
      if (e.key === "ArrowDown" || e.key === "Tab") {
        e.preventDefault();
        setFocusedIdx((i) => (i + 1) % allOptions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => (i - 1 + allOptions.length) % allOptions.length);
      } else if (e.key === "Enter") {
        select(focusedIdx);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [frozen, focusedIdx, allOptions.length, select, typingCustom]);

  return (
    <div className="font-mono space-y-1">
      {/* Stepper header: back arrow + progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          disabled={stepIndex === 0 || frozen}
          className="shrink-0 text-[14px] leading-none transition-colors disabled:opacity-20 disabled:pointer-events-none"
          style={{ color: "#00d4ff" }}
          title="Go back"
        >
          ←
        </button>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-[2px] flex-1 rounded-full transition-colors"
            style={{
              background:
                i < stepIndex
                  ? "#10b981"
                  : i === stepIndex
                  ? "#00d4ff"
                  : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
        <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-1">
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* Question */}
      <p className="text-[12.5px] font-bold mb-2" style={{ color: "#00d4ff" }}>
        {question.question}
      </p>

      {/* Options */}
      {allOptions.map((opt, idx) => {
        const isSelected = selectedIdx === idx;
        const isFocused = focusedIdx === idx;
        const isCustom = idx === options.length;

        return (
          <div
            key={opt}
            onClick={() => select(idx)}
            className={`flex items-center gap-2 px-1 py-0.5 rounded cursor-pointer transition-colors ${
              isFocused && !frozen ? "bg-white/[0.04]" : ""
            } ${frozen ? "pointer-events-none" : ""}`}
          >
            {/* Cursor */}
            <span className="text-[12px] w-3 shrink-0" style={{ color: "#00d4ff" }}>
              {isFocused ? "›" : " "}
            </span>

            {/* Index */}
            <span className="text-[12px] shrink-0 text-muted-foreground/40 w-4">
              {idx + 1}.
            </span>

            {/* Checkbox */}
            <span
              className="text-[12px] shrink-0 whitespace-nowrap"
              style={{ color: isSelected ? "#10b981" : "rgba(255,255,255,0.3)" }}
            >
              {isSelected ? "[✓]" : "[ ]"}
            </span>

            {/* Label */}
            <div className="flex-1 min-w-0">
              {isCustom && typingCustom ? (
                <input
                  autoFocus
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customText.trim()) {
                      e.stopPropagation();
                      confirm(idx, customText);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border-b border-white/20 text-[12px] text-foreground focus:outline-none focus:border-electric/60 placeholder:text-muted-foreground/40 pb-0.5"
                  placeholder="type your answer, then Enter…"
                />
              ) : (
                <span
                  className={`text-[12px] ${
                    isSelected ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {opt}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Hint */}
      {!frozen && (
        <p className="text-[10.5px] text-muted-foreground/30 pt-1 pl-10">
          Enter to select · Tab/Arrow keys to navigate · click to pick
        </p>
      )}
    </div>
  );
}

export default function ClarificationCard({
  questions,
  frozen,
}: {
  questions: ClarificationQuestion[];
  frozen: boolean;
}) {
  const setAnswer = useArchitectureStore((s) => s.setClarificationAnswer);
  const [currentStep, setCurrentStep] = useState(0);
  const [allAnswered, setAllAnswered] = useState(false);

  const handleNext = useCallback(
    (questionId: string, answer: string) => {
      setAnswer(questionId, answer);
      if (currentStep < questions.length - 1) {
        setTimeout(() => setCurrentStep((s) => s + 1), 300);
      } else {
        setAllAnswered(true);
      }
    },
    [currentStep, questions.length, setAnswer]
  );

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setAllAnswered(false);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  // After actual submission (frozen=true), show confirmed state
  if (frozen) {
    return (
      <p className="font-mono text-[11px] text-muted-foreground/40">
        ✓ Answers submitted — generating architecture…
      </p>
    );
  }

  // All steps answered but Submit not yet clicked — prompt them to submit
  if (allAnswered) {
    return (
      <div className="font-mono space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => { setAllAnswered(false); setCurrentStep(questions.length - 1); }}
            className="text-[14px] leading-none transition-colors"
            style={{ color: "#00d4ff" }}
            title="Go back"
          >
            ←
          </button>
          {Array.from({ length: questions.length }).map((_, i) => (
            <div key={i} className="h-[2px] flex-1 rounded-full" style={{ background: "#10b981" }} />
          ))}
          <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-1">
            {questions.length}/{questions.length}
          </span>
        </div>
        <p className="text-[11px] pl-5" style={{ color: "#10b981" }}>
          ✓ All questions answered — click Submit Answers ↓
        </p>
      </div>
    );
  }

  const question = questions[currentStep];
  if (!question) return null;

  return (
    <QuestionStep
      key={question.id}
      question={question}
      frozen={frozen}
      stepIndex={currentStep}
      totalSteps={questions.length}
      onNext={handleNext}
      onBack={handleBack}
    />
  );
}
