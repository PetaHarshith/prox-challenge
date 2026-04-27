import { CheckCircle2 } from "lucide-react";

export function TroubleshootingFlow({ steps }: { steps: string[] }) {
  if (!steps.length) return null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-zinc-950">Troubleshooting path</h3>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              {index + 1}
            </div>
            <div className="flex min-w-0 items-start gap-2 text-sm text-zinc-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>{step}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
