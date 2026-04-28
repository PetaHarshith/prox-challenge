"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, X } from "lucide-react";

export type TroubleshootingItem = { cause: string; check: string; fix: string };
type StepState = "pending" | "fixed" | "skipped";

type TroubleshootingFlowProps = {
  steps?: string[];
  items?: TroubleshootingItem[];
  symptom?: string;
};

export function TroubleshootingFlow({ steps, items, symptom }: TroubleshootingFlowProps) {
  const nodes = useMemo<TroubleshootingItem[]>(() => {
    if (items?.length) return items;
    if (steps?.length) return steps.map((step) => ({ cause: step, check: step, fix: step }));
    return [];
  }, [items, steps]);

  const [states, setStates] = useState<StepState[]>(() => nodes.map(() => "pending"));
  const [openIdx, setOpenIdx] = useState<number>(0);

  if (!nodes.length) return null;

  const activeStates = states.length === nodes.length ? states : nodes.map(() => "pending" as StepState);
  const allFixed = activeStates.every((s) => s === "fixed");
  const allChecked = activeStates.every((s) => s !== "pending");
  const issuePersists = allChecked && activeStates.some((s) => s === "skipped");

  function setState(index: number, state: StepState) {
    setStates((current) => {
      const next = current.length === nodes.length ? [...current] : nodes.map(() => "pending" as StepState);
      next[index] = state;
      return next;
    });
    if (state === "skipped" && index + 1 < nodes.length) setOpenIdx(index + 1);
  }

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <header className="mb-3 flex items-center gap-2 rounded-xl border border-acid/25 bg-acid/10 px-3 py-2">
        <AlertTriangle size={16} className="shrink-0 text-acid" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-acid">Symptom</div>
          <div className="truncate text-sm font-semibold text-text-primary">{symptom ?? "Weld defect reported"}</div>
        </div>
      </header>

      <ol className="relative ml-3 border-l-2 border-dashed border-black/[0.12]">
        {nodes.map((item, index) => {
          const state = activeStates[index];
          const isOpen = openIdx === index;
          const isLast = index === nodes.length - 1;
          const tone =
            state === "fixed" ? "border-emerald-300/35 bg-emerald-400/10"
              : state === "skipped" ? "border-black/[0.08] bg-white/[0.03] opacity-70"
                : isOpen ? "border-acid/35 bg-acid/10"
                  : "border-black/[0.08] bg-card";
          const dotTone =
            state === "fixed" ? "bg-emerald-400 text-black"
              : state === "skipped" ? "bg-white/15 text-text-secondary"
                : isOpen ? "bg-acid text-black" : "bg-black text-text-secondary border border-black/20";

          return (
            <li key={`${item.cause}-${index}`} className={`relative pb-3 pl-5 ${isLast ? "pb-0" : ""}`}>
              <span className={`absolute -left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${dotTone}`}>
                {state === "fixed" ? <Check size={13} /> : state === "skipped" ? <X size={12} /> : index + 1}
              </span>

              <div className={`rounded-xl border p-3 transition ${tone}`}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? -1 : index)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Check #{index + 1}</div>
                    <div className="text-sm font-semibold text-text-primary">{item.cause}</div>
                  </div>
                  <ChevronDown size={16} className={`mt-1 shrink-0 text-text-secondary transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="mt-2 space-y-2 border-t border-black/[0.08] pt-2">
                    <div className="text-sm text-text-secondary">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">How to check: </span>
                      {item.check}
                    </div>
                    <div className="flex items-start gap-1.5 text-sm text-text-primary">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span><span className="font-semibold">Fix: </span>{item.fix}</span>
                    </div>
                    {state === "pending" ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setState(index, "fixed")}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check size={12} /> Fixed it
                        </button>
                        <button
                          type="button"
                          onClick={() => setState(index, "skipped")}
                          className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-card px-2.5 py-1 text-xs font-semibold text-text-secondary hover:bg-black/5 hover:text-text-primary"
                        >
                          <X size={12} /> Still happening
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setState(index, "pending")}
                        className="text-[11px] font-semibold text-text-secondary underline-offset-2 hover:underline"
                      >
                        Reset this step
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {allFixed ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300">
          <CheckCircle2 size={16} /> Resolved — every check is marked fixed. Run a short test bead before a real weld.
        </div>
      ) : issuePersists ? (
        <div className="mt-3 rounded-xl border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-text-primary">
          Issue persists — at least one check is still happening. Share a close-up photo of the bead or move to the next manual check.
        </div>
      ) : null}
    </section>
  );
}
