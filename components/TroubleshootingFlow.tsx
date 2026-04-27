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
  const fixed = activeStates.some((s) => s === "fixed");
  const allSkipped = activeStates.every((s) => s === "skipped");

  function setState(index: number, state: StepState) {
    setStates((current) => {
      const next = current.length === nodes.length ? [...current] : nodes.map(() => "pending" as StepState);
      next[index] = state;
      return next;
    });
    if (state === "skipped" && index + 1 < nodes.length) setOpenIdx(index + 1);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
        <AlertTriangle size={16} className="shrink-0 text-amber-700" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Symptom</div>
          <div className="truncate text-sm font-semibold text-amber-950">{symptom ?? "Weld defect reported"}</div>
        </div>
      </header>

      <ol className="relative ml-3 border-l-2 border-dashed border-zinc-300">
        {nodes.map((item, index) => {
          const state = activeStates[index];
          const isOpen = openIdx === index;
          const isLast = index === nodes.length - 1;
          const tone =
            state === "fixed" ? "border-emerald-300 bg-emerald-50"
              : state === "skipped" ? "border-zinc-200 bg-zinc-50 opacity-70"
                : isOpen ? "border-torch/40 bg-orange-50/60"
                  : "border-zinc-200 bg-white";
          const dotTone =
            state === "fixed" ? "bg-emerald-500 text-white"
              : state === "skipped" ? "bg-zinc-300 text-zinc-600"
                : isOpen ? "bg-torch text-white" : "bg-white text-zinc-700 border border-zinc-300";

          return (
            <li key={`${item.cause}-${index}`} className={`relative pb-3 pl-5 ${isLast ? "pb-0" : ""}`}>
              <span className={`absolute -left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${dotTone}`}>
                {state === "fixed" ? <Check size={13} /> : state === "skipped" ? <X size={12} /> : index + 1}
              </span>

              <div className={`rounded-md border p-3 transition ${tone}`}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? -1 : index)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Check #{index + 1}</div>
                    <div className="text-sm font-semibold text-zinc-900">{item.cause}</div>
                  </div>
                  <ChevronDown size={16} className={`mt-1 shrink-0 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen ? (
                  <div className="mt-2 space-y-2 border-t border-zinc-200/70 pt-2">
                    <div className="text-sm text-zinc-700">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">How to check: </span>
                      {item.check}
                    </div>
                    <div className="flex items-start gap-1.5 text-sm text-zinc-900">
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
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          <X size={12} /> Still happening
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setState(index, "pending")}
                        className="text-[11px] font-semibold text-zinc-500 underline-offset-2 hover:underline"
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

      {fixed ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <CheckCircle2 size={16} /> Resolved — run a short test bead before a real weld.
        </div>
      ) : allSkipped ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nothing here fixed it. Share a close-up photo of the bead so we can diagnose visually.
        </div>
      ) : null}
    </section>
  );
}
