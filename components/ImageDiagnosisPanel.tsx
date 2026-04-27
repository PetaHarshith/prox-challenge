import { AlertTriangle, CheckCircle2, Camera } from "lucide-react";

export type ImageDiagnosis = {
  category: "weld_bead_defect" | "wiring_setup" | "front_panel" | "wire_feed" | "unknown";
  likelyIssue: string;
  visualClues: string[];
  checks: string[];
  fixes: string[];
  confidence: "low" | "medium" | "high";
  caution?: string;
};

export function ImageDiagnosisPanel({
  diagnosis,
  reference
}: {
  diagnosis: ImageDiagnosis;
  reference?: { title: string; page?: string };
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Camera size={18} className="text-torch" />
        <h3 className="text-sm font-semibold text-zinc-950">Image diagnosis</h3>
      </div>

      <div className="rounded-md bg-zinc-100 p-3 text-sm">
        <p className="font-semibold text-zinc-950">Likely issue: {diagnosis.likelyIssue}</p>
        <p className="mt-1 text-xs text-zinc-600">Confidence: {diagnosis.confidence}</p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Visual clues</p>
          <ul className="space-y-1 text-sm text-zinc-800">
            {diagnosis.visualClues.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Checks to run first</p>
          <ul className="space-y-1 text-sm text-zinc-800">
            {diagnosis.checks.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-torch" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">Fixes</p>
        <ul className="space-y-1 text-sm text-zinc-800">
          {diagnosis.fixes.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      </div>

      {diagnosis.caution ? (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{diagnosis.caution}</span>
        </div>
      ) : null}

      {reference ? (
        <p className="mt-3 text-xs text-zinc-600">
          Related manual reference: {reference.title}
          {reference.page ? ` (p.${reference.page})` : ""}
        </p>
      ) : null}
    </section>
  );
}
