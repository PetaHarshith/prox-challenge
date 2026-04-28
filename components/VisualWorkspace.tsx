"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Cable, Clock3, ExternalLink, FileImage, Gauge, Loader2, SlidersHorizontal } from "lucide-react";
import { CustomSetupDiagram } from "@/components/CustomSetupDiagram";
import { DutyCycleCard } from "@/components/DutyCycleCard";
import { ManualImageCard } from "@/components/ManualImageCard";
import { ImageDiagnosisPanel } from "@/components/ImageDiagnosisPanel";
import { ProcessSelectionMatrix } from "@/components/ProcessSelectionMatrix";
import { SettingsRecommendationCard } from "@/components/SettingsRecommendationCard";
import { WarningCard } from "@/components/WarningCard";
import type { AgentResponse, VisualSpec } from "@/lib/agentResponse";
import { dutyCycleRows, recommendSettings, type ManualRef, type WeldProcess } from "@/lib/manualKnowledge";

type WorkspaceResponse = AgentResponse & { warning?: string; usedModel?: string };
type WorkspaceTab = "answer" | "setup" | "duty" | "settings";

const processes: Array<Exclude<WeldProcess, "unknown">> = ["mig", "flux-core", "tig", "stick"];
const materials = ["mild steel", "stainless steel", "aluminum"] as const;
const thicknesses = ["24 gauge", "18 gauge", "1/8 inch", "3/16 inch", "1/4 inch"] as const;

function nearestDutyCycle(inputVoltage: "120V" | "240V", amperage: number) {
  const rows = dutyCycleRows.filter((row) => row.input === inputVoltage);
  return rows.reduce((best, row) => {
    const rowAmps = Number(row.amperage.replace("A", ""));
    const bestAmps = Number(best.amperage.replace("A", ""));
    return Math.abs(rowAmps - amperage) < Math.abs(bestAmps - amperage) ? row : best;
  }, rows[0]);
}

export function VisualWorkspace({ response, userQuestion, isLoading }: { response?: WorkspaceResponse; userQuestion?: string; isLoading?: boolean }) {
  const [tab, setTab] = useState<WorkspaceTab>("answer");
  const [process, setProcess] = useState<Exclude<WeldProcess, "unknown">>("mig");
  const [dutyVoltage, setDutyVoltage] = useState<"120V" | "240V">("240V");
  const [amperage, setAmperage] = useState(200);
  const [material, setMaterial] = useState<(typeof materials)[number]>("mild steel");
  const [thickness, setThickness] = useState<(typeof thicknesses)[number]>("1/8 inch");
  const [settingsVoltage, setSettingsVoltage] = useState<"120V" | "240V">("240V");

  const duty = nearestDutyCycle(dutyVoltage, amperage);
  const recommendation = useMemo(
    () => recommendSettings({ process, material, thickness, inputVoltage: settingsVoltage }),
    [process, material, thickness, settingsVoltage]
  );

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    { id: "answer", label: "Answer", icon: <FileImage size={15} /> },
    { id: "setup", label: "Setup", icon: <Cable size={15} /> },
    { id: "duty", label: "Duty", icon: <Clock3 size={15} /> },
    { id: "settings", label: "Settings", icon: <SlidersHorizontal size={15} /> }
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col border-t border-black/[0.08] bg-[#F7F6F1] xl:border-l xl:border-t-0">
      <div className="border-b border-black/[0.08] bg-[#F7F6F1] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Visual workspace</h2>
            <p className="text-xs text-text-secondary">Diagrams, checklists, and calculators</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 rounded-lg border border-black/[0.08] bg-card p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition ${tab === item.id ? "bg-[#171A1F] text-white" : "text-text-secondary hover:text-text-primary"
                }`}
            >
              {item.icon}
              <span className="hidden xl:inline">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "answer" ? (
          isLoading ? (
            <LoadingWorkspace />
          ) : response ? (
            response.visuals?.length ? (
              <div className="space-y-4">
                {response.visuals.map((spec, index) => (
                  <VisualSpecRenderer
                    key={`${spec.kind}-${index}`}
                    spec={spec}
                    refs={response.refs}
                    userQuestion={userQuestion}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {response.visualType === "polarity" ? (
                  <WorkspaceSection title="Setup Diagram" refs={response.refs}>
                    {response.highlightContext?.emphasis ? (
                      <div className="rounded-lg border border-black/[0.08] bg-card-soft px-3 py-2 text-xs font-medium text-text-primary">
                        {response.highlightContext.emphasis}
                      </div>
                    ) : null}
                    <CustomSetupDiagram process={response.process} />
                  </WorkspaceSection>
                ) : null}
                {response.visualType === "duty-cycle" && response.dutyCycleRows ? (
                  <WorkspaceSection title="Duty Cycle" refs={response.refs}>
                    <InteractiveDutyCycle
                      rows={response.dutyCycleRows}
                      initialKey={response.highlightContext?.highlightKey}
                    />
                  </WorkspaceSection>
                ) : null}
                {response.visualType === "process-selection" ? (
                  <WorkspaceSection title="Process Selection" refs={response.refs}>
                    <ProcessSelectionMatrix highlightProcess={response.recommendedProcess} />
                  </WorkspaceSection>
                ) : null}
                {response.visualType === "image-diagnosis" && response.imageDiagnosis ? (
                  <WorkspaceSection title="Image Diagnosis" refs={response.refs}>
                    <ImageDiagnosisPanel
                      diagnosis={response.imageDiagnosis}
                      reference={response.refs?.[0] ? { title: response.refs[0].title, page: response.refs[0].page } : undefined}
                    />
                  </WorkspaceSection>
                ) : null}
                {response.settingRecommendation ? (
                  <WorkspaceSection title="Settings Recommendation" refs={response.refs}>
                    <SettingsRecommendationCard recommendation={response.settingRecommendation} />
                  </WorkspaceSection>
                ) : null}
                {response.manualImages?.map((manualImage) => (
                  <WorkspaceSection key={manualImage.title} title={manualImage.title} refs={manualImage.refs}>
                    <ManualImageCard image={manualImage} />
                  </WorkspaceSection>
                ))}
                {!response.manualImages?.length &&
                  response.visualType !== "polarity" &&
                  response.visualType !== "duty-cycle" &&
                  response.visualType !== "process-selection" &&
                  response.visualType !== "image-diagnosis" &&
                  response.visualType !== "troubleshooting" &&
                  !response.settingRecommendation ? (
                  <EmptyWorkspace />
                ) : null}
              </div>
            )
          ) : (
            <EmptyWorkspace />
          )
        ) : null}

        {tab === "setup" ? (
          <div className="space-y-3">
            <select
              value={process}
              onChange={(event) => setProcess(event.target.value as Exclude<WeldProcess, "unknown">)}
              className="h-10 w-full rounded-xl border border-black/[0.08] bg-card-soft px-3 text-sm text-text-primary outline-none"
            >
              {processes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <WorkspaceSection title="Setup Diagram">
              <CustomSetupDiagram process={process} />
            </WorkspaceSection>
          </div>
        ) : null}

        {tab === "duty" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <select
                value={dutyVoltage}
                onChange={(event) => setDutyVoltage(event.target.value as "120V" | "240V")}
                className="h-10 rounded-xl border border-black/[0.08] bg-card-soft px-3 text-sm text-text-primary outline-none"
              >
                <option value="120V">120V input</option>
                <option value="240V">240V input</option>
              </select>
              <div className="flex h-10 min-w-16 items-center justify-center rounded-xl bg-[#171A1F] px-3 text-sm font-semibold text-white">
                {amperage}A
              </div>
            </div>
            <input
              type="range"
              min={30}
              max={dutyVoltage === "120V" ? 140 : 220}
              step={5}
              value={amperage}
              onChange={(event) => setAmperage(Number(event.target.value))}
              className="w-full accent-brass"
            />
            <div className="rounded-xl border border-black/[0.08] bg-card-soft p-3 text-sm leading-6 text-text-secondary">
              Closest manual rating: <strong>{duty.input}</strong> at <strong>{duty.amperage}</strong> is{" "}
              <strong>{duty.dutyCycle}</strong>. Weld <strong>{duty.weldMinutes} min</strong>, rest{" "}
              <strong>{duty.restMinutes} min</strong> per 10 minutes.
            </div>
            <WorkspaceSection title="Duty Cycle">
              <DutyCycleCard
                rows={dutyCycleRows}
                highlightKey={`${duty.input}-${duty.amperage}`}
                highlightLabel={`${duty.weldMinutes} min weld / ${duty.restMinutes} min rest`}
              />
            </WorkspaceSection>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <select
                value={material}
                onChange={(event) => setMaterial(event.target.value as (typeof materials)[number])}
                className="h-10 rounded-xl border border-black/[0.08] bg-card-soft px-3 text-sm text-text-primary outline-none"
              >
                {materials.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={thickness}
                onChange={(event) => setThickness(event.target.value as (typeof thicknesses)[number])}
                className="h-10 rounded-xl border border-black/[0.08] bg-card-soft px-3 text-sm text-text-primary outline-none"
              >
                {thicknesses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={settingsVoltage}
                onChange={(event) => setSettingsVoltage(event.target.value as "120V" | "240V")}
                className="h-10 rounded-xl border border-black/[0.08] bg-card-soft px-3 text-sm text-text-primary outline-none"
              >
                <option value="120V">120V input</option>
                <option value="240V">240V input</option>
              </select>
            </div>
            <WorkspaceSection title="Settings Recommendation">
              <SettingsRecommendationCard recommendation={recommendation} />
            </WorkspaceSection>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function WorkspaceSection({ children, refs, title }: { children: ReactNode; refs?: ManualRef[]; title: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
      </div>
      {children}
      {refs?.length ? <SourceSummary refs={refs} /> : null}
    </section>
  );
}

function SourceSummary({ refs }: { refs: ManualRef[] }) {
  return (
    <div className="rounded-lg border border-black/[0.08] bg-card px-3 py-2">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {refs.map((ref) => (
          <a
            key={`${ref.source}-${ref.title}`}
            href={ref.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-black/[0.1] bg-card-soft px-2.5 py-1 text-xs font-medium text-text-primary transition hover:border-black/20 hover:bg-white"
          >
            {ref.source}
            {ref.page ? ` p.${ref.page}` : ""}
            <ExternalLink size={11} />
          </a>
        ))}
      </div>
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-panel">
      <div className="mb-2 flex items-center gap-2">
        <Gauge size={17} className="text-acid" />
        <h3 className="text-sm font-semibold text-text-primary">Workspace preview</h3>
      </div>
      <p className="text-sm leading-6 text-text-secondary">
        Ask a setup, duty-cycle, troubleshooting, or settings question to render the matching diagram, manual page, checklist,
        or calculator here.
      </p>
      <p className="mt-3 text-xs leading-5 text-text-secondary">
        This panel follows the chat and updates when the assistant returns visual or tabular guidance.
      </p>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] bg-card px-4 py-3 text-sm text-text-secondary shadow-panel">
        <Loader2 size={17} className="animate-spin text-text-primary" />
        <span>Preparing visual...</span>
      </div>
    </div>
  );
}

// Renders a single VisualSpec from the server-built visuals[] list. The server
// is responsible for ordering, so this component is intentionally dumb.
function VisualSpecRenderer({
  spec,
  refs,
  userQuestion
}: {
  spec: VisualSpec;
  refs?: ManualRef[];
  userQuestion?: string;
}) {
  if (spec.kind === "setup_diagram") {
    return (
      <WorkspaceSection title="Setup Diagram" refs={refs}>
        <CustomSetupDiagram process={spec.process} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "duty_cycle") {
    return (
      <WorkspaceSection title="Duty Cycle" refs={refs}>
        <InteractiveDutyCycle rows={spec.rows} initialKey={spec.highlightKey} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "process_matrix") {
    return (
      <WorkspaceSection title="Process Selection" refs={refs}>
        <ProcessSelectionMatrix highlightProcess={spec.recommendedProcess} />
      </WorkspaceSection>
    );
  }
  // troubleshooting_flow renders inline in the chat bubble — skip in workspace.
  if (spec.kind === "troubleshooting_flow") return null;
  if (spec.kind === "manual_image") {
    return (
      <WorkspaceSection title={spec.image.title} refs={spec.image.refs}>
        <ManualImageCard image={spec.image} interpretation={spec.interpretation} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "settings_card") {
    return (
      <WorkspaceSection title="Settings Recommendation" refs={refs}>
        <SettingsRecommendationCard recommendation={spec.recommendation} />
      </WorkspaceSection>
    );
  }
  if (spec.kind === "image_diagnosis") {
    return (
      <WorkspaceSection title="Image Diagnosis" refs={refs}>
        <ImageDiagnosisPanel diagnosis={spec.diagnosis} reference={spec.reference} />
      </WorkspaceSection>
    );
  }
  // pre_weld_checklist renders inline in the chat bubble — skip in workspace.
  if (spec.kind === "pre_weld_checklist") return null;
  if (spec.kind === "warnings") {
    return (
      <WorkspaceSection title="Warnings">
        <WarningCard warnings={spec.warnings} />
      </WorkspaceSection>
    );
  }
  return null;
}

function InteractiveDutyCycle({ rows, initialKey }: { rows: typeof dutyCycleRows; initialKey?: string }) {
  const seed = useMemo(() => {
    if (initialKey) {
      const match = rows.find((row) => `${row.input}-${row.amperage}` === initialKey);
      if (match) return { voltage: match.input, amps: Number(match.amperage.replace("A", "")) };
    }
    return { voltage: "240V" as const, amps: 200 };
  }, [initialKey, rows]);

  const [voltage, setVoltage] = useState<"120V" | "240V">(seed.voltage);
  const [amps, setAmps] = useState<number>(seed.amps);

  const duty = nearestDutyCycle(voltage, amps);
  const max = voltage === "120V" ? 140 : 220;
  const min = 30;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-black/[0.08] bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-black/[0.08] bg-card-soft p-1">
            {(["120V", "240V"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVoltage(v);
                  if (v === "120V" && amps > 140) setAmps(140);
                }}
                className={`h-7 rounded-md px-2.5 text-xs font-medium ${voltage === v ? "bg-white text-text-primary" : "text-text-secondary"}`}
              >
                {v} input
              </button>
            ))}
          </div>
          <div className="flex h-8 min-w-16 items-center justify-center rounded-lg bg-[#171A1F] px-3 text-sm font-semibold text-white">
            {amps}A
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={5}
          value={amps}
          onChange={(event) => setAmps(Number(event.target.value))}
          className="w-full accent-brass"
        />
        <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wide text-text-secondary">
          <span>{min}A</span>
          <span>{max}A</span>
        </div>
        <div className="mt-2 rounded-lg border border-black/[0.08] bg-card-soft px-3 py-2 text-sm leading-6 text-text-primary">
          At <strong>{duty.amperage}</strong> on <strong>{duty.input}</strong>: weld{" "}
          <strong>{duty.weldMinutes} min</strong>, rest <strong>{duty.restMinutes} min</strong>{" "}
          (<strong>{duty.dutyCycle}</strong> duty cycle).
        </div>
      </div>
      <DutyCycleCard
        rows={rows}
        highlightKey={`${duty.input}-${duty.amperage}`}
        highlightLabel={`${duty.weldMinutes} min weld / ${duty.restMinutes} min rest`}
      />
    </div>
  );
}
