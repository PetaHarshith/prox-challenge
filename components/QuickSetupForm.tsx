"use client";

import { useState } from "react";
import { Wand2, X } from "lucide-react";
import type { QuickSetupAnswers } from "@/lib/quickSetup";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (answers: QuickSetupAnswers) => void;
};

type FieldConfig<K extends keyof QuickSetupAnswers> = {
  key: K;
  label: string;
  options: ReadonlyArray<{ value: QuickSetupAnswers[K]; label: string }>;
};

const fields = [
  {
    key: "location",
    label: "Where are you welding?",
    options: [
      { value: "indoors", label: "Indoors" },
      { value: "outdoors", label: "Outdoors" }
    ]
  } as FieldConfig<"location">,
  {
    key: "hasGas",
    label: "Do you have shielding gas?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ]
  } as FieldConfig<"hasGas">,
  {
    key: "material",
    label: "Material",
    options: [
      { value: "mild steel", label: "Mild steel" },
      { value: "stainless steel", label: "Stainless steel" },
      { value: "aluminum", label: "Aluminum" },
      { value: "not sure", label: "Not sure" }
    ]
  } as FieldConfig<"material">,
  {
    key: "thickness",
    label: "Thickness",
    options: [
      { value: "thin sheet", label: "Thin sheet" },
      { value: "1/8 inch", label: "1/8 inch" },
      { value: "1/4 inch+", label: "1/4 inch+" },
      { value: "not sure", label: "Not sure" }
    ]
  } as FieldConfig<"thickness">
];

export function QuickSetupForm({ open, onClose, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Partial<QuickSetupAnswers>>({});

  if (!open) return null;

  const allAnswered = fields.every((f) => answers[f.key]);

  function pick<K extends keyof QuickSetupAnswers>(key: K, value: QuickSetupAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    if (!allAnswered) return;
    onSubmit(answers as QuickSetupAnswers);
    setAnswers({});
  }

  function handleClose() {
    setAnswers({});
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Quick Setup">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-black/[0.08] bg-card shadow-none">
        <header className="flex items-start justify-between gap-3 border-b border-black/[0.08] bg-card px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-[#171A1F]">
              <Wand2 size={17} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Quick Setup</h2>
              <p className="text-xs text-text-secondary">Answer 4 quick questions and I&apos;ll recommend a process and checklist.</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-md p-1 text-text-secondary hover:bg-black/5 hover:text-text-primary" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {fields.map((field) => (
            <div key={field.key}>
              <div className="mb-1.5 text-sm font-semibold text-text-primary">{field.label}</div>
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const selected = answers[field.key] === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => pick(field.key, opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected ? "border-brass bg-brass text-[#171A1F]" : "border-black/[0.08] bg-card text-text-secondary hover:border-black/15 hover:text-text-primary"}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-black/[0.08] bg-card-soft px-5 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-black/[0.08] bg-card px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-black/5 hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-2 text-sm font-semibold text-[#171A1F] hover:bg-[#A7EA32] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={14} />
            Generate setup
          </button>
        </footer>
      </div>
    </div>
  );
}
