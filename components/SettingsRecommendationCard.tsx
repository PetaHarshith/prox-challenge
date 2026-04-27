import { Gauge, Info } from "lucide-react";
import type { SettingRecommendation } from "@/lib/manualKnowledge";

export function SettingsRecommendationCard({ recommendation }: { recommendation: SettingRecommendation }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gauge size={18} className="text-torch" />
        <h3 className="text-sm font-semibold text-zinc-950">Setup recommendation</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-4">
        <div className="rounded-md bg-zinc-100 p-2">
          <div className="text-xs font-semibold uppercase text-zinc-500">Process</div>
          <div className="font-semibold text-zinc-950">{recommendation.process}</div>
        </div>
        <div className="rounded-md bg-zinc-100 p-2">
          <div className="text-xs font-semibold uppercase text-zinc-500">Material</div>
          <div className="font-semibold text-zinc-950">{recommendation.material}</div>
        </div>
        <div className="rounded-md bg-zinc-100 p-2">
          <div className="text-xs font-semibold uppercase text-zinc-500">Thickness</div>
          <div className="font-semibold text-zinc-950">{recommendation.thickness}</div>
        </div>
        <div className="rounded-md bg-zinc-100 p-2">
          <div className="text-xs font-semibold uppercase text-zinc-500">Input</div>
          <div className="font-semibold text-zinc-950">{recommendation.inputVoltage}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-800">{recommendation.summary}</p>
      {recommendation.exactMatch === false ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          The manual does not give an exact setting for this full combination. Use this as the closest grounded starting point.
          {recommendation.missingInfo?.length ? ` Missing details: ${recommendation.missingInfo.join(", ")}.` : ""}
        </div>
      ) : null}
      <ol className="mt-3 space-y-2">
        {recommendation.steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-sm leading-6 text-zinc-800">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {recommendation.caution ? (
        <div className="mt-3 flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>{recommendation.caution}</span>
        </div>
      ) : null}
    </section>
  );
}
