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
  /\bporosity\b|\bporous\b|\bpinholes?\b|\bspatter\b|\bproblem\b|\bwrong\b|\bbird.?nest\b|\bburn[- ]through\b|\bdefect\b|\bunstable arc\b|\bcraters?\b|\bholes? in\b|\bbubbles?\b|\bslipping\b|\bno arc\b|\bwon'?t arc\b|\bweak weld\b|\bweld(?:s)? (?:has|have|look|looks|seems?|are)\b/;

// Specific defect nouns. Used to tell apart a real troubleshooting question
// ("my welds have pinholes") from a vague one ("my weld looks bad") that
// cannot be answered without knowing what the user actually sees.
const SPECIFIC_DEFECT_RE =
  /\bporosity\b|\bporous\b|\bpinholes?\b|\bspatter\b|\bbird.?nest\b|\bburn[- ]through\b|\bcraters?\b|\bundercut\b|\bcracking\b|\bcracks?\b|\bunstable arc\b|\bholes? in\b|\bbubbles?\b|\bslipping\b|\bno arc\b|\bwon'?t arc\b|\bweak weld\b|\bdrop[- ]?through\b|\bwavy\b|\btoo (?:hot|cold)\b|\bwon'?t stick\b/;

// Vague trouble phrasing on its own (no defect noun). Examples: "my weld
// looks bad", "something is wrong with my weld", "weld doesn't look right".
const VAGUE_TROUBLE_RE =
  /\bbad weld\b|\bweak weld\b|\bugly weld\b|\bweld(?:s)? (?:looks?|seems?|are) (?:bad|off|wrong|weird|ugly|terrible)\b|\bsomething(?:'s| is) wrong\b|\bdoesn'?t look right\b|\bmessed up\b|\blooks off\b/;

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
        ? [
          "Happy to walk you through the setup \u2014 a couple of quick details first:",
          "- Which process are you using (MIG, flux-core, TIG, or stick)?",
          "- Do you have shielding gas available?",
          "- What material are you welding?",
          "",
          "Once I have that, I\u2019ll give you the exact cable diagram and steps."
        ].join("\n")
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

  // 4. Troubleshooting. If only vague phrasing matched (no specific defect
  //    noun like porosity/spatter/burn-through), we cannot diagnose without
  //    guessing. Ask for the defect type or a photo instead of returning a
  //    generic checklist.
  if (TROUBLE_RE.test(lower) || VAGUE_TROUBLE_RE.test(lower)) {
    const hasSpecificDefect = SPECIFIC_DEFECT_RE.test(lower);
    if (!hasSpecificDefect) {
      return {
        intent: "troubleshooting",
        process,
        slots,
        requiredFacts: ["Defect type", "Process", "Image (optional)"],
        visualType: "none",
        visualId: undefined,
        needsClaudeVision: false,
        needsClarification: true,
        clarificationQuestion: [
          "Got it \u2014 let me narrow it down. A couple of details would help:",
          "- What does the bead actually look like (pinholes, spatter, burn-through, wavy, bird-nesting)?",
          "- Which process are you running (MIG, flux-core, TIG, or stick)?",
          "- If you can, snap a close-up photo and I\u2019ll diagnose it directly."
        ].join("\n")
      };
    }
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

const WIRE_LOADING_RE = /\b(load(?:ing)?|spool|drive roller|wire feed compartment|wire tension|liner)\b/;
const SETTINGS_RE = /\b(setting|settings|recommend|wire speed|voltage setting|thickness|gauge|ga\b|mild steel|stainless|aluminum|1\/8|3\/16|1\/4)\b/;

// Multi-visual planner: returns the ordered visuals to render for this message.
// Always derived from the live message — never carries state from prior turns.
//
// Regression cases (these MUST stay green):
//
//  1. "I'm welding 1/8 steel outdoors with no gas at 200A on 240V. Which
//     process should I use, how should I wire it, and how long can I weld?"
//     -> [process_selection_matrix, setup_diagram(flux-core), duty_cycle_matrix]
//
//  2. "My flux-core welds have pinholes and look porous. What's wrong?"
//     -> [troubleshooting_flow, manual_image_card(weld diagnosis)]
//
//  3. "If I'm running 200A on 240V, how long can I weld?"
//     -> [duty_cycle_matrix]   (no stale setup diagram)
//
//  4. "I'm setting up flux-core outdoors with no gas. Where exactly do my
//     cables go?"
//     -> [setup_diagram(flux-core)]   (no stale duty cycle)
export function planVisuals(message: string, hasUploadedImage: boolean): PlannerVisualType[] {
  // Uploaded image -> diagnosis panel + cause/check/fix flow + the manual's
  // weld-diagnosis reference page (so the image becomes reasoning evidence,
  // not just decoration).
  if (hasUploadedImage) return ["image_diagnosis_panel", "troubleshooting_flow", "manual_image_card"];

  const lower = message.toLowerCase();
  const slots = extractSlots(message);
  const visuals: PlannerVisualType[] = [];

  const isSetup = SETUP_RE.test(lower);
  const isDuty = DUTY_RE.test(lower);
  const isTrouble = TROUBLE_RE.test(lower);
  const isProcessChoice = PROCESS_SELECTION_RE.test(lower);
  const isWireLoading = WIRE_LOADING_RE.test(lower);
  const isSettings = SETTINGS_RE.test(lower) && !isSetup && !isDuty && !isTrouble;

  // Process choice goes first when explicitly asked OR implied by "no gas /
  // outdoors" combined with setup/duty context.
  if (isProcessChoice || (/(no gas|don'?t have gas|outdoors|outside)/.test(lower) && (isSetup || isDuty))) {
    visuals.push("process_selection_matrix");
  }

  if (isTrouble) visuals.push("troubleshooting_flow");

  if (isSetup && slots.process !== "unknown") visuals.push("setup_diagram");
  // Implied flux-core setup from "no gas / outdoors" + cable phrasing.
  else if (isSetup && /(no gas|don'?t have gas|outdoors|outside)/.test(lower)) visuals.push("setup_diagram");

  if (isDuty) visuals.push("duty_cycle_matrix");

  if (isWireLoading) visuals.push("manual_image_card");

  if (isSettings) visuals.push("settings_card");

  // Troubleshooting always pairs with the weld diagnosis manual image so the
  // visual cue (porosity holes, spatter, etc.) becomes reasoning evidence.
  if (isTrouble && !visuals.includes("manual_image_card")) visuals.push("manual_image_card");

  // Empty -> no visual (chat-only answer).
  return visuals;
}

