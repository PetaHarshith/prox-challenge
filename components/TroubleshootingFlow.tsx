import { CheckCircle2 } from "lucide-react";

export type TroubleshootingItem = { cause: string; check: string; fix: string };

type TroubleshootingFlowProps = {
  steps?: string[];
  items?: TroubleshootingItem[];
};

export function TroubleshootingFlow({ steps, items }: TroubleshootingFlowProps) {
  if (items?.length) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-zinc-950">Cause → check → fix</h3>
        <ol className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item.cause}-${index}`} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                  {index + 1}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cause</span>
                <span className="text-sm text-zinc-800">{item.cause}</span>
              </div>
              <div className="mb-1 pl-7 text-sm text-zinc-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Check: </span>
                {item.check}
              </div>
              <div className="flex items-start gap-2 pl-7 text-sm text-zinc-900">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <span><span className="font-semibold">Fix: </span>{item.fix}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (!steps?.length) return null;

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
