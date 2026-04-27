import { AlertTriangle, Info } from "lucide-react";
import type { SmartWarning } from "@/lib/smartWarnings";

export function WarningCard({ warnings }: { warnings: SmartWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="space-y-2">
      {warnings.map((w) => {
        const isWarn = w.severity === "warning";
        return (
          <div
            key={w.id}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm leading-5 shadow-sm ${isWarn ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-950" : "border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-950"}`}
          >
            {isWarn ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
            ) : (
              <Info size={16} className="mt-0.5 shrink-0 text-blue-700" />
            )}
            <span>{w.text}</span>
          </div>
        );
      })}
    </section>
  );
}
