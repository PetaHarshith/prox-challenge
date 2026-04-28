"use client";

import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Zap } from "lucide-react";
import type { FaultCode, FaultSeverity } from "@/lib/faultCodes";
import { SourceChips } from "@/components/SourceChips";
import { stripInlineMarkdown } from "@/lib/textFormat";

const severityStyle: Record<FaultSeverity, { chip: string; ring: string; icon: React.ReactNode }> = {
  info: {
    chip: "border-black/[0.08] bg-card-soft text-text-secondary",
    ring: "border-black/[0.08]",
    icon: <Info size={15} className="text-text-secondary" />
  },
  warning: {
    chip: "border-brass/40 bg-brass/15 text-[#5b4a00]",
    ring: "border-brass/40",
    icon: <Zap size={15} className="text-[#5b4a00]" />
  },
  danger: {
    chip: "border-ember/40 bg-ember/10 text-ember",
    ring: "border-ember/40",
    icon: <ShieldAlert size={15} className="text-ember" />
  }
};

export function FaultCodeCard({ fault }: { fault: FaultCode }) {
  const style = severityStyle[fault.severity];
  return (
    <section className={`rounded-xl border bg-card p-4 shadow-none ${style.ring}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {style.icon}
          <h3 className="text-sm font-semibold text-text-primary">{fault.label}</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.chip}`}>
          {fault.code}
        </span>
      </header>

      <p className="text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">Where you see it: </span>
        {stripInlineMarkdown(fault.indicator)}
      </p>

      <p className="mt-3 text-sm text-text-primary">{stripInlineMarkdown(fault.whatYoureSeeing)}</p>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-50/60 p-2.5">
        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
        <p className="text-xs text-emerald-900">
          <span className="font-semibold">Is it safe? </span>
          {stripInlineMarkdown(fault.isSafe)}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            <AlertTriangle size={12} />
            Likely causes
          </p>
          <ul className="space-y-1 text-xs text-text-secondary">
            {fault.causes.map((cause) => (
              <li key={cause} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-secondary/60" />
                <span>{stripInlineMarkdown(cause)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            <CheckCircle2 size={12} />
            Recovery
          </p>
          <ol className="space-y-1.5 text-xs text-text-secondary">
            {fault.recovery.map((step, i) => (
              <li key={step} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brass text-[10px] font-bold text-[#171A1F]">
                  {i + 1}
                </span>
                <span>{stripInlineMarkdown(step)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {fault.refs.length ? (
        <div className="mt-3 border-t border-black/[0.06] pt-3">
          <SourceChips refs={fault.refs} />
        </div>
      ) : null}
    </section>
  );
}
