import type { WeldProcess } from "./manualKnowledge";
import type { PlannerIntent, PlannerSlots } from "./outputPlanner";

// Structured knowledge extracted from the manual's images (selection chart,
// wiring diagrams, weld diagnosis page). The agent uses this as reasoning
// input — it is NOT just for display.

export type ProcessSelectionRow = {
  process: Exclude<WeldProcess, "unknown">;
  gasRequired: boolean;
  bestUseCase: string;
  limitations: string;
  notes: string;
  sourcePage: string;
};

export const processSelectionKnowledge: ProcessSelectionRow[] = [
  {
    process: "mig",
    gasRequired: true,
    bestUseCase: "Clean indoor work on mild steel 24 ga – 1/4 in.",
    limitations: "Needs a gas cylinder; wind blows shielding gas away outdoors.",
    notes: "Lowest spatter and easiest puddle control of the wire processes.",
    sourcePage: "Selection Chart p.1"
  },
  {
    process: "flux-core",
    gasRequired: false,
    bestUseCase: "Outdoors or in drafts; no gas cylinder available.",
    limitations: "More spatter and slag; cosmetic welds need cleanup.",
    notes: "Self-shielded — wire is the shielding source. Polarity is reversed vs MIG.",
    sourcePage: "Selection Chart p.1"
  },
  {
    process: "tig",
    gasRequired: true,
    bestUseCase: "Thin material, stainless, aluminum, precision/cosmetic welds.",
    limitations: "Slowest; steepest learning curve; needs foot pedal and clean metal.",
    notes: "Wire feed must be disconnected. Uses argon gas + tungsten electrode.",
    sourcePage: "Selection Chart p.1"
  },
  {
    process: "stick",
    gasRequired: false,
    bestUseCase: "Thick, dirty, rusty, or outdoor work; structural repair.",
    limitations: "Slag must be chipped; harder to start and hold an arc.",
    notes: "No wire feed, no gas. Pick rod by material and thickness.",
    sourcePage: "Selection Chart p.1"
  }
];

export type WeldDiagnosis = {
  defect: string;
  visualCues: string[];
  likelyCauses: string[];
  fixes: string[];
  sourcePage: string;
};

export const weldDiagnosisKnowledge: WeldDiagnosis[] = [
  {
    defect: "Porosity",
    visualCues: ["Pinholes or small craters in the bead", "Hollow / sponge-like surface"],
    likelyCauses: [
      "Wrong polarity for the process",
      "Dirty metal (oil, paint, rust, mill scale, moisture)",
      "MIG only: low gas flow, empty cylinder, draft blowing gas away"
    ],
    fixes: [
      "Confirm polarity matches the process (TIG/flux-core ground +, MIG/stick ground −)",
      "Clean the joint to bare metal before welding",
      "MIG only: check cylinder valve, regulator flow, and shield from drafts"
    ],
    sourcePage: "Owner's Manual p.37"
  },
  {
    defect: "Excessive spatter",
    visualCues: ["Splatter balls around the bead", "Bead looks ragged or rough"],
    likelyCauses: ["Wrong polarity", "Voltage too low for wire speed", "Long stick-out"],
    fixes: ["Verify polarity for the process", "Raise voltage or lower wire speed by one notch", "Shorten stick-out and steady the travel angle"],
    sourcePage: "Owner's Manual p.37"
  },
  {
    defect: "Burn-through",
    visualCues: ["Hole melted through the workpiece", "Drop-through on the back side"],
    likelyCauses: ["Settings too hot for the thickness", "Travel speed too slow", "Gap too wide"],
    fixes: ["Drop amperage / voltage one notch", "Speed up travel", "Tack and close gaps before the final pass"],
    sourcePage: "Owner's Manual p.37"
  },
  {
    defect: "Wavy / inconsistent bead",
    visualCues: ["Uneven ripples", "Width changes along the bead"],
    likelyCauses: ["Inconsistent travel speed or angle", "Wire feed slipping (drive tension or liner)"],
    fixes: ["Brace the gun and keep a steady angle", "Check drive roller tension and clean the liner", "Make one test bead after each adjustment"],
    sourcePage: "Owner's Manual p.37"
  },
  {
    defect: "Bird-nesting at the drive roller",
    visualCues: ["Tangled wire wadded up at the feeder"],
    likelyCauses: ["Drive tension too tight or too loose", "Worn liner or wrong contact tip size"],
    fixes: ["Reset drive tension to just hold the wire without crushing it", "Match contact tip and roller groove to wire diameter", "Inspect and replace a kinked liner"],
    sourcePage: "Owner's Manual p.37"
  }
];

export type WiringSetup = {
  process: Exclude<WeldProcess, "unknown">;
  connections: { ground: "+" | "−"; primary: { name: string; polarity: "+" | "−" }; gas: boolean; footPedal: boolean };
  warnings: string[];
  sourcePage: string;
};

export const wiringSetupKnowledge: Record<Exclude<WeldProcess, "unknown">, WiringSetup> = {
  "flux-core": { process: "flux-core", connections: { ground: "+", primary: { name: "Wire feed cable", polarity: "−" }, gas: false, footPedal: false }, warnings: ["Do not connect shielding gas — wire is self-shielding."], sourcePage: "Owner's Manual p.13" },
  mig: { process: "mig", connections: { ground: "−", primary: { name: "Wire feed cable", polarity: "+" }, gas: true, footPedal: false }, warnings: ["Open the gas cylinder valve and confirm regulator flow before striking an arc."], sourcePage: "Owner's Manual p.14" },
  tig: { process: "tig", connections: { ground: "+", primary: { name: "TIG torch", polarity: "−" }, gas: true, footPedal: true }, warnings: ["Disconnect the wire feed cable.", "Plug the foot pedal into the socket inside the machine."], sourcePage: "Owner's Manual p.24" },
  stick: { process: "stick", connections: { ground: "−", primary: { name: "Electrode holder", polarity: "+" }, gas: false, footPedal: false }, warnings: ["No gas line and no wire feed for stick."], sourcePage: "Owner's Manual p.27" }
};

// Returns a compact text block the route can splice into the Claude prompt for
// the current intent. Keeping this as a string keeps the prompt simple.
export function getVisualKnowledgeForIntent(intent: PlannerIntent, slots: PlannerSlots): string {
  if (intent === "process_selection") {
    const lines = processSelectionKnowledge.map(
      (row) => `- ${row.process}: gas=${row.gasRequired ? "yes" : "no"}; best for ${row.bestUseCase}; limits: ${row.limitations}; ${row.notes} (${row.sourcePage})`
    );
    return ["PROCESS SELECTION KNOWLEDGE (use to justify recommendation):", ...lines].join("\n");
  }
  if (intent === "troubleshooting" || intent === "weld_image_diagnosis") {
    const lines = weldDiagnosisKnowledge.map(
      (d) => `- ${d.defect}: cues=[${d.visualCues.join("; ")}]; causes=[${d.likelyCauses.join("; ")}]; fixes=[${d.fixes.join("; ")}] (${d.sourcePage})`
    );
    return ["WELD DIAGNOSIS KNOWLEDGE (map symptom \u2192 cause \u2192 fix):", ...lines].join("\n");
  }
  if (intent === "setup" || intent === "polarity") {
    const targets: Array<Exclude<WeldProcess, "unknown">> =
      slots.process !== "unknown" ? [slots.process] : ["mig", "flux-core", "tig", "stick"];
    const lines = targets.map((p) => {
      const w = wiringSetupKnowledge[p];
      return `- ${p}: ground \u2192 ${w.connections.ground}, ${w.connections.primary.name} \u2192 ${w.connections.primary.polarity}; gas=${w.connections.gas}; footPedal=${w.connections.footPedal}; warnings=[${w.warnings.join("; ")}] (${w.sourcePage})`;
    });
    return ["WIRING SETUP KNOWLEDGE (use exact connections, do not invent):", ...lines].join("\n");
  }
  return "";
}

// Returns the structured troubleshooting items for the response payload so the
// UI can render cause/check/fix triplets instead of a flat list.
export function getTroubleshootingItems(question: string): Array<{ cause: string; check: string; fix: string }> {
  const lower = question.toLowerCase();
  const match = weldDiagnosisKnowledge.find((d) => lower.includes(d.defect.toLowerCase().split(" ")[0]));
  const target = match ?? weldDiagnosisKnowledge[0];
  const len = Math.min(target.likelyCauses.length, target.fixes.length);
  return Array.from({ length: len }, (_, i) => ({
    cause: target.likelyCauses[i],
    check: target.visualCues[i] ?? `Inspect for: ${target.likelyCauses[i]}`,
    fix: target.fixes[i]
  }));
}
