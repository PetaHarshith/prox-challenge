import type { ConversationState } from "./conversationState";
import { detectProcess, extractMaterial, extractThickness, type WeldProcess } from "./manualKnowledge";

export type PlannerIntent =
  | "setup"
  | "polarity"
  | "duty_cycle"
  | "process_selection"
  | "settings_recommendation"
  | "troubleshooting"
  | "weld_image_diagnosis"
  | "manual_image_question"
  | "wire_loading"
  | "front_panel_controls"
  | "general";

export type PlannerVisualType =
  | "setup_diagram"
  | "duty_cycle_matrix"
  | "process_selection_matrix"
  | "settings_card"
  | "troubleshooting_flow"
  | "image_diagnosis_panel"
  | "manual_image_card"
  | "none";

export type SetupTopic = "torch" | "ground" | "wire feed" | "electrode" | "gas" | "foot pedal";

export type PlannerSlots = {
  process: WeldProcess;
  voltage?: "120V" | "240V";
  amperage?: number;
  topic?: SetupTopic;
};

export type OutputPlan = {
  intent: PlannerIntent;
  process: WeldProcess;
  slots: PlannerSlots;
  requiredFacts: string[];
  visualType: PlannerVisualType;
  visualId?: string;
  needsClaudeVision: boolean;
  needsClarification: boolean;
  clarificationQuestion?: string;
};

export function extractSlots(message: string): PlannerSlots {
  const lower = message.toLowerCase();
  const process = detectProcess(message);
  const voltage: PlannerSlots["voltage"] = /\b240\s*v?\b/.test(lower)
    ? "240V"
    : /\b120\s*v?\b/.test(lower)
      ? "120V"
      : undefined;
  const ampMatch = lower.match(/\b(\d{2,3})\s*a(?:mp(?:s|erage)?)?\b/);
  const amperage = ampMatch ? Number(ampMatch[1]) : undefined;

  let topic: SetupTopic | undefined;
  if (/\btig torch\b|\btorch\b/.test(lower)) topic = "torch";
  else if (/\belectrode holder\b|\belectrode\b|\brod\b/.test(lower)) topic = "electrode";
  else if (/\bfoot pedal\b/.test(lower)) topic = "foot pedal";
  else if (/\bground clamp\b|\bwork lead\b|\bground\b/.test(lower)) topic = "ground";
  else if (/\bwire feed\b|\bwire cable\b|\bmig gun\b/.test(lower)) topic = "wire feed";
  else if (/\bgas line\b|\bregulator\b|\bshielding gas\b|\bgas hose\b/.test(lower)) topic = "gas";

  return { process, voltage, amperage, topic };
}

// Strict 5-priority keyword routing. Mentioning a process noun (TIG/MIG/etc.)
// alone never selects process_selection — that branch needs explicit
// choose/compare phrasing or "X vs Y".

const SETUP_RE =
  /\b(connect|connects|connected|connection|connecting|socket|sockets|polarity|ground|torch|electrode|hook ?up|cable|cables|plug|wire feed|setup|set ?up|setting up|where (do|does|should) .* (go|plug|connect))\b/;

const DUTY_RE =
  /\bduty\b|\bweld continuously\b|\bcontinuously at\b|\boverheat(?:ing)?\b|\bthermal shutdown\b|\b\d{2,3}\s*a(?:mp(?:s|erage)?)?\b/;

const TROUBLE_RE =
  /\bporosity\b|\bporous\b|\bpinholes?\b|\bspatter\b|\bproblem\b|\bwrong\b|\bbird.?nest\b|\bburn[- ]through\b|\bdefect\b|\bunstable arc\b|\bcraters?\b|\bholes? in\b|\bweld(?:s)? (?:has|have|look|looks)\b/;

const PROCESS_SELECTION_RE =
  /\bchoose\b|\bwhich process\b|\bwhat process\b|\bcompare\b|\bbest process\b|\bshould i use\b|\bdifference between\b|\b(mig|tig|flux(?:-?core)?|stick)\s+(vs\.?|versus)\s+(mig|tig|flux(?:-?core)?|stick)\b|\bdon'?t have gas\b/;

export function planOutput({
  message,
  hasUploadedImage,
  conversationState
}: {
  message: string;
  hasUploadedImage: boolean;
  conversationState?: ConversationState;
}): OutputPlan {
  const lower = message.toLowerCase();
  const slots = extractSlots(message);
  const process = slots.process;

  // 1. Uploaded image -> image_diagnosis (highest priority)
  if (hasUploadedImage) {
    return {
      intent: /weld|bead|porosity|spatter|burn/.test(lower) ? "weld_image_diagnosis" : "manual_image_question",
      process,
      slots,
      requiredFacts: ["Image classification", "Visible cues", "Safety-relevant checks"],
      visualType: "image_diagnosis_panel",
      visualId: "weld-diagnosis",
      needsClaudeVision: true,
      needsClarification: false
    };
  }

  // 2. Setup / polarity (BEFORE process_selection so a TIG/MIG mention does not
  //    trigger the comparison matrix).
  if (SETUP_RE.test(lower)) {
    const needsClarification = process === "unknown" && !conversationState?.pending;
    const setupVisualId = process !== "unknown" ? `${process}-setup-diagram` : undefined;
    return {
      intent: "setup",
      process,
      slots,
      requiredFacts: ["Correct polarity mapping", "Cable destination sockets", "Process-specific gas requirement"],
      visualType: needsClarification ? "none" : "setup_diagram",
      visualId: setupVisualId,
      needsClaudeVision: false,
      needsClarification,
      clarificationQuestion: needsClarification
        ? "Which process are you setting up: MIG, flux-core, TIG, or stick?"
        : undefined
    };
  }

  // 3. Duty cycle
  if (DUTY_RE.test(lower)) {
    return {
      intent: "duty_cycle",
      process,
      slots,
      requiredFacts: ["Input voltage", "Amperage row", "Weld/rest minutes in 10-minute window"],
      visualType: "duty_cycle_matrix",
      visualId: "duty-cycle-chart",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 4. Troubleshooting
  if (TROUBLE_RE.test(lower)) {
    return {
      intent: "troubleshooting",
      process,
      slots,
      requiredFacts: ["Likely causes", "Checks in order", "Manual diagnosis references"],
      visualType: "troubleshooting_flow",
      visualId: "weld-diagnosis",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 5. Process selection — only explicit choose/compare/X-vs-Y phrasings.
  if (PROCESS_SELECTION_RE.test(lower)) {
    return {
      intent: "process_selection",
      process,
      slots,
      requiredFacts: ["Process comparison matrix", "Gas/outdoor constraints", "Material target"],
      visualType: "process_selection_matrix",
      visualId: "process-selection-chart",
      needsClaudeVision: false,
      needsClarification: false
    };
  }

  // 6. General — no visual; Claude answers the exact question.
  return {
    intent: "general",
    process,
    slots,
    requiredFacts: ["Answer the user's exact question"],
    visualType: "none",
    visualId: undefined,
    needsClaudeVision: false,
    needsClarification: false
  };
}

export function structuredCacheKey(plan: OutputPlan, message: string) {
  const material = extractMaterial(message) ?? "unknown-material";
  const thickness = extractThickness(message) ?? "unknown-thickness";
  const amp = message.toLowerCase().match(/(\d+)\s*a(?:mp)?/)?.[1] ?? "unknown-amp";
  const voltage = /240/.test(message) ? "240V" : /120/.test(message) ? "120V" : "unknown-voltage";
  return [plan.intent, plan.process, voltage, amp, material, thickness].join("|").toLowerCase();
}
