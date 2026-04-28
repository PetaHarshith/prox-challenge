import { Clock3 } from "lucide-react";
import type { DutyCycleRow } from "@/lib/manualKnowledge";

type DutyCycleCardProps = {
  rows: DutyCycleRow[];
  highlightKey?: string;
  highlightLabel?: string;
};

function indicatorBars(percent: number) {
  if (percent >= 100) return "■■■";
  if (percent >= 40) return "■■□";
  return "■□□";
}

export function DutyCycleCard({ rows, highlightKey, highlightLabel }: DutyCycleCardProps) {
  const activeKey = highlightKey ?? `${rows[0]?.input ?? "240V"}-${rows[0]?.amperage ?? "200A"}`;

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 size={18} className="text-acid" />
        <h3 className="text-sm font-semibold text-text-primary">MIG duty cycle</h3>
      </div>
      {highlightLabel ? (
        <div className="mb-3 rounded-xl border border-acid/25 bg-acid/10 px-3 py-2 text-xs font-semibold text-acid">
          {highlightLabel}
        </div>
      ) : null}
      <div className="grid gap-2">
        {rows.map((row) => {
          const rowKey = `${row.input}-${row.amperage}`;
          const highlighted = rowKey === activeKey;
          const dutyPercent = Number(row.dutyCycle.replace("%", ""));
          return (
            <div
              key={rowKey}
              className={`grid grid-cols-[58px_64px_54px_1fr] items-center gap-2 rounded-md p-3 text-sm transition ${highlighted
                ? "border border-acid/30 bg-acid/10"
                : "bg-card opacity-70"
                }`}
            >
            <span className="font-semibold text-text-primary">{row.input}</span>
            <span>{row.amperage}</span>
            <span className="font-semibold text-acid">{row.dutyCycle}</span>
            <span className={`text-xs leading-5 ${highlighted ? "text-text-primary" : "text-text-secondary"}`}>
              <span className="mr-2 font-mono text-[11px]">{indicatorBars(dutyPercent)}</span>
              {row.weldMinutes} min weld / {row.restMinutes} min rest
            </span>
          </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-text-secondary">
        Duty cycle is measured over 10 minutes. Stop and let the machine cool when you hit the rated weld time.
      </p>
    </section>
  );
}
