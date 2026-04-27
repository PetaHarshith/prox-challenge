"use client";

import { useState } from "react";
import { Check, ChevronDown, ListChecks } from "lucide-react";
import type { ChecklistItem } from "@/lib/quickSetup";
import { preWeldChecklists } from "@/lib/quickSetup";
import type { WeldProcess } from "@/lib/manualKnowledge";

type Props = {
  process: Exclude<WeldProcess, "unknown">;
  items?: ChecklistItem[];
  title?: string;
};

const labelByProcess: Record<Exclude<WeldProcess, "unknown">, string> = {
  mig: "MIG pre-weld checklist",
  "flux-core": "Flux-core pre-weld checklist",
  tig: "TIG pre-weld checklist",
  stick: "Stick pre-weld checklist"
};

export function PreWeldChecklist({ process, items, title }: Props) {
  const list = items?.length ? items : preWeldChecklists[process];
  const [checked, setChecked] = useState<boolean[]>(() => list.map(() => false));
  const [openHint, setOpenHint] = useState<number | null>(null);

  const total = list.length;
  const done = checked.filter(Boolean).length;
  const allDone = total > 0 && done === total;

  function toggle(index: number) {
    setChecked((current) => {
      const next = current.length === total ? [...current] : list.map(() => false);
      next[index] = !next[index];
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/45 p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white">
            <ListChecks size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-950">{title ?? labelByProcess[process]}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${allDone ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
          {done}/{total}
        </span>
      </header>

      <ul className="space-y-2">
        {list.map((item, index) => {
          const isChecked = !!checked[index];
          const isHintOpen = openHint === index;
          return (
            <li
              key={`${item.text}-${index}`}
              className={`rounded-md border p-2.5 transition ${isChecked ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-white/90"}`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  aria-pressed={isChecked}
                  aria-label={isChecked ? "Uncheck item" : "Check item"}
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isChecked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"}`}
                >
                  <Check size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className={`block w-full text-left text-sm leading-5 ${isChecked ? "text-slate-500 line-through" : "text-slate-900"}`}
                  >
                    {item.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenHint(isHintOpen ? null : index)}
                    aria-expanded={isHintOpen}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Not sure?
                    <ChevronDown size={11} className={`transition ${isHintOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isHintOpen ? (
                    <p className="mt-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-700 ring-1 ring-slate-100">
                      {item.hint}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {allDone ? (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <Check size={15} /> All checks complete — strike a short test arc on scrap first.
        </div>
      ) : null}
    </section>
  );
}
