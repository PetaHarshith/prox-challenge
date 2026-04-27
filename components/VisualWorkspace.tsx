"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Cable, Clock3, FileImage, Gauge, SlidersHorizontal } from "lucide-react";
import { CustomSetupDiagram } from "@/components/CustomSetupDiagram";
import { DutyCycleCard } from "@/components/DutyCycleCard";
import { ManualImageCard } from "@/components/ManualImageCard";
import { ImageDiagnosisPanel } from "@/components/ImageDiagnosisPanel";
import { ProcessSelectionMatrix } from "@/components/ProcessSelectionMatrix";
import { SettingsRecommendationCard } from "@/components/SettingsRecommendationCard";
import { TroubleshootingFlow } from "@/components/TroubleshootingFlow";
import type { AgentResponse } from "@/lib/agentResponse";
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

export function VisualWorkspace({ response, userQuestion }: { response?: WorkspaceResponse; userQuestion?: string }) {
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
    <aside className="flex min-h-0 flex-col border-t border-zinc-200 bg-white xl:border-l xl:border-t-0">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">Visual workspace</h2>
            <p className="text-xs text-zinc-500">Diagrams, manual pages, and calculators</p>
          </div>
          <BookOpen size={18} className="text-torch" />
        </div>
        <div className="mt-3 grid grid-cols-4 rounded-md bg-zinc-100 p-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded px-2 text-xs font-semibold ${tab === item.id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950"
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
          response ? (
            <div className="space-y-4">
              {response.visualType === "polarity" ? (
                <WorkspaceSection title="Setup Diagram" refs={response.refs}>
                  {response.highlightContext?.emphasis ? (
                    <div className="rounded-md border border-torch/30 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-900">
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
              {response.visualType === "troubleshooting" && (response.troubleshootingItems?.length || response.checklist?.length) ? (
                <WorkspaceSection title="Troubleshooting Path" refs={response.refs}>
                  <TroubleshootingFlow
                    steps={response.checklist}
                    items={response.troubleshootingItems}
                    symptom={userQuestion}
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
          ) : (
            <EmptyWorkspace />
          )
        ) : null}

        {tab === "setup" ? (
          <div className="space-y-3">
            <select
              value={process}
              onChange={(event) => setProcess(event.target.value as Exclude<WeldProcess, "unknown">)}
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value="120V">120V input</option>
                <option value="240V">240V input</option>
              </select>
              <div className="flex h-10 min-w-16 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white">
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
              className="w-full accent-torch"
            />
            <div className="rounded-md bg-zinc-100 p-3 text-sm leading-6 text-zinc-800">
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
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      </div>
      {children}
      {refs?.length ? <SourceSummary refs={refs} /> : null}
    </section>
  );
}

function SourceSummary({ refs }: { refs: ManualRef[] }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">
      <span className="font-semibold text-zinc-800">Sources: </span>
      {refs.map((ref, index) => (
        <span key={`${ref.source}-${ref.title}`}>
          <a href={ref.url} target="_blank" rel="noreferrer" className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2">
            {ref.source}
            {ref.page ? ` p.${ref.page}` : ""}
          </a>
          {index < refs.length - 1 ? ", " : ""}
        </span>
      ))}
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Gauge size={17} className="text-torch" />
        <h3 className="text-sm font-semibold text-zinc-950">Workspace preview</h3>
      </div>
      <p className="text-sm leading-6 text-zinc-700">
        Ask a setup, duty-cycle, troubleshooting, or settings question to render the matching diagram, manual page, checklist,
        or calculator here.
      </p>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        This panel follows the chat and updates when the assistant returns visual or tabular guidance.
      </p>
    </div>
  );
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
      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-md bg-zinc-100 p-1">
            {(["120V", "240V"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVoltage(v);
                  if (v === "120V" && amps > 140) setAmps(140);
                }}
                className={`h-7 rounded px-2.5 text-xs font-semibold ${voltage === v ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500"}`}
              >
                {v} input
              </button>
            ))}
          </div>
          <div className="flex h-8 min-w-16 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white">
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
          className="w-full accent-torch"
        />
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          <span>{min}A</span>
          <span>{max}A</span>
        </div>
        <div className="mt-2 rounded-md bg-orange-50 px-3 py-2 text-sm leading-6 text-orange-900">
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
