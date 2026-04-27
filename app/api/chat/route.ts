import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AgentResponseSchema, localGroundedResponse, normalizeAgentResponse, type AgentResponse, type VisualSpec } from "@/lib/agentResponse";
import { agentToolNames } from "@/lib/claudeAgent";
import { nextConversationState, resolveConversationalQuestion, type ConversationState } from "@/lib/conversationState";
import { retrieveManualContext, manualImages, processManualImageIndex, type ManualImage, type WeldProcess } from "@/lib/manualKnowledge";
import { findManualImageById, getManualImageRef } from "@/lib/manualImageIndex";
import { planOutput, planVisuals, structuredCacheKey, type PlannerVisualType } from "@/lib/outputPlanner";
import type { VisualType } from "@/lib/manualKnowledge";
import {
  getImageInterpretation,
  getTroubleshootingItems,
  getVisualKnowledgeForIntent,
  weldDiagnosisKnowledge
} from "@/lib/manualVisualKnowledge";

export const runtime = "nodejs";

// System prompt: keep tight so Claude stays within the JSON budget and answers
// the specific question instead of asking for clarification or padding output.
const systemPrompt = [
  "You are a welding assistant for the Vulcan OmniPro 220.",
  "Answer ONLY the user's exact question. Be specific, practical, and correct.",
  "Keep the chat answer CONCISE — a 1-2 sentence direct answer + at most 3 short steps. The visual workspace carries the detailed diagram/table/flow.",
  "Do not repeat in prose what a diagram or table already shows.",
  "If the user asks about TIG, answer TIG only. If they ask flux-core, answer flux-core only.",
  "Never enumerate all four processes (MIG, flux-core, TIG, stick) unless the user explicitly asked to choose or compare.",
  "If the user describes a wrong setup, call it out and show the corrected setup.",
  "Only ask a clarifying question when the question is truly ambiguous (e.g., no process and no context). Otherwise answer directly.",
  "Only mention an uploaded image if the user attached one this turn."
].join("\n");

// Detects the generic "Use MIG / TIG / flux-core" comparison block when the
// user asked a specific question.
function isGenericMultiProcessAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  if (!/use mig if|use mig for|use mig when/.test(lower)) return false;
  const processCount = ["mig", "tig", "flux", "stick"].filter((p) => lower.includes(p)).length;
  return processCount >= 3;
}

// Detects the localGroundedResponse "Tell me what you are setting up..."
// fallback so we can replace it with a real diagnosis when an image is present.
function isGenericClarificationFallback(answer: string): boolean {
  return /tell me what you are setting up or fixing/i.test(answer);
}

// Composes a chat answer directly from imageDiagnosis so the user always gets
// a real visual diagnosis (never the generic clarification fallback) when an
// image is attached.
function composeImageDiagnosisAnswer(d: NonNullable<AgentResponse["imageDiagnosis"]>): string {
  const lines: string[] = [];
  lines.push(`This looks like **${d.likelyIssue}** (confidence: ${d.confidence}).`);
  if (d.visualClues.length) {
    lines.push("");
    lines.push("Visible clues:");
    d.visualClues.slice(0, 4).forEach((c) => lines.push(`- ${c}`));
  }
  if (d.fixes.length) {
    lines.push("");
    lines.push("First checks:");
    d.fixes.slice(0, 4).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }
  if (d.caution) {
    lines.push("");
    lines.push(`Note: ${d.caution}`);
  }
  return lines.join("\n");
}

// Builds cause/check/fix items from the live image diagnosis so the
// troubleshooting flow visual reflects what was actually seen in the photo
// (not generic catalog defaults).
function troubleshootingItemsFromDiagnosis(
  d: NonNullable<AgentResponse["imageDiagnosis"]>
): Array<{ cause: string; check: string; fix: string }> {
  const len = Math.max(d.checks.length, d.fixes.length, d.visualClues.length);
  const items: Array<{ cause: string; check: string; fix: string }> = [];
  for (let i = 0; i < len; i++) {
    items.push({
      cause: d.visualClues[i] ?? d.likelyIssue,
      check: d.checks[i] ?? "Inspect the bead and surrounding metal.",
      fix: d.fixes[i] ?? "Adjust based on the cause above."
    });
  }
  return items;
}

// Map planner visual types to UI visual types so the workspace always reflects
// the routed intent and never holds a stale visual from a previous turn.
const plannerVisualToUi: Record<PlannerVisualType, VisualType> = {
  setup_diagram: "polarity",
  duty_cycle_matrix: "duty-cycle",
  process_selection_matrix: "process-selection",
  settings_card: "settings",
  troubleshooting_flow: "troubleshooting",
  image_diagnosis_panel: "image-diagnosis",
  manual_image_card: "manual-image",
  none: "text"
};

// Builds the canonical, ordered list of visuals for this response. The server
// always rebuilds this from the live planner output so the workspace shows
// exactly the right diagrams/tables/flows for the latest turn — never stale
// visuals from a previous question.
function buildVisualsFromPlan(
  plannedVisuals: PlannerVisualType[],
  response: AgentResponse,
  question: string
): VisualSpec[] {
  const out: VisualSpec[] = [];
  const seen = new Set<string>();
  const slotProcess: WeldProcess = response.process;

  function pushManualImage(image: ManualImage | undefined, q: string) {
    if (!image) return;
    const key = `manual_image:${image.src}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: "manual_image", image, interpretation: getImageInterpretation(image.src, q) });
  }

  for (const v of plannedVisuals) {
    if (v === "setup_diagram") {
      const proc: Exclude<WeldProcess, "unknown"> =
        slotProcess !== "unknown" ? slotProcess : "flux-core";
      out.push({ kind: "setup_diagram", process: proc });
      const wiring = manualImages[processManualImageIndex[proc]];
      pushManualImage(wiring, question);
    } else if (v === "duty_cycle_matrix" && response.dutyCycleRows?.length) {
      out.push({
        kind: "duty_cycle",
        rows: response.dutyCycleRows,
        highlightKey: response.highlightContext?.highlightKey,
        highlightLabel: response.highlightContext?.highlightLabel
      });
    } else if (v === "process_selection_matrix") {
      out.push({ kind: "process_matrix", recommendedProcess: response.recommendedProcess });
    } else if (v === "troubleshooting_flow") {
      out.push({
        kind: "troubleshooting_flow",
        items: response.troubleshootingItems,
        checklist: response.checklist,
        symptom: question
      });
    } else if (v === "manual_image_card") {
      const candidate = response.manualImages?.[0];
      pushManualImage(candidate, question);
    } else if (v === "settings_card" && response.settingRecommendation) {
      out.push({ kind: "settings_card", recommendation: response.settingRecommendation });
    } else if (v === "image_diagnosis_panel" && response.imageDiagnosis) {
      const ref = response.refs?.[0];
      out.push({
        kind: "image_diagnosis",
        diagnosis: response.imageDiagnosis,
        reference: ref ? { title: ref.title, page: ref.page } : undefined
      });
    }
  }

  return out;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  conversationState?: ConversationState;
  image?: {
    data: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  };
};

const responseJsonInstruction = `Return only compact JSON with this shape:
{
  "answer": "Clear, practical explanation. **Bold** important terms. Numbered steps (max 3 unless a full procedure is asked). Optional Tip / Next.",
  "reasoning_summary": "Optional. 1 short sentence on WHY this answer is correct (which chart/diagram/section drove the decision).",
  "highlights": {"process":"optional", "key_setting":"optional (e.g. '200A @ 240V → 25%')", "warning":"optional safety/contradiction warning"},
  "visualType": "polarity" | "duty-cycle" | "troubleshooting" | "manual-image" | "settings" | "process-selection" | "image-diagnosis" | "text",
  "process": "mig" | "flux-core" | "tig" | "stick" | "unknown",
  "refs": [{"title":"...", "source":"Owner's Manual" | "Quick Start Guide" | "Selection Chart", "page":"optional", "url":"..."}],
  "checklist": ["optional troubleshooting steps"],
  "manualImages": [{"title":"...", "description":"...", "src":"...", "refs":[...]}],
  "settingRecommendation": {"process":"mig|flux-core|tig|stick", "material":"...", "thickness":"...", "inputVoltage":"120V|240V", "summary":"...", "steps":["..."], "caution":"optional"},
  "recommendedProcess": "mig|flux-core|tig|stick",
  "imageDiagnosis": {"category":"weld_bead_defect|wiring_setup|front_panel|wire_feed|unknown","likelyIssue":"...","visualClues":["..."],"checks":["..."],"fixes":["..."],"confidence":"low|medium|high","caution":"optional"},
  "troubleshootingItems": [{"cause":"...", "check":"...", "fix":"..."}],
  "highlightContext": {"type":"duty-cycle|polarity|troubleshooting", "highlightKey":"optional", "highlightLabel":"optional", "emphasis":"optional"}
}

Rules:
- "answer" is REQUIRED and must be a complete, specific answer to the user's question.
- "reasoning_summary" and "highlights" are optional — include only when they add value (warning chip on contradictions, key_setting on duty cycle, etc.).
- For troubleshooting questions, fill "troubleshootingItems" with cause→check→fix triples.
- For duty cycle, fill "highlightContext.highlightKey" as "<voltage>-<amperage>" and "highlightLabel" as "<weld> min weld / <rest> min rest".`;

function latestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const rawQuestion = latestUserMessage(body.messages);

  if (!rawQuestion) {
    return NextResponse.json({ error: "A user message is required." }, { status: 400 });
  }

  const resolved = resolveConversationalQuestion({
    messages: body.messages,
    question: rawQuestion,
    state: body.conversationState
  });
  const question = resolved.question;
  const outputPlan = planOutput({
    message: question,
    hasUploadedImage: Boolean(body.image?.data),
    conversationState: body.conversationState
  });
  const cacheKey = structuredCacheKey(outputPlan, question);

  // Shortcuts (prebuilt answers, response cache, tryDirectResponse) are
  // intentionally bypassed: every request goes to Claude so each answer is
  // grounded in the user's exact question instead of a generic template.

  const context = retrieveManualContext(question);
  const fallback = localGroundedResponse(question);
  const indexedVisual = findManualImageById(outputPlan.visualId);
  const visualFacts = indexedVisual ? indexedVisual.extractedFacts : [];

  // Ambiguity short-circuit: if the planner detected critical info is missing
  // (vague setup, vague troubleshooting), return a focused 3-bullet
  // clarification instead of guessing. Skips Claude entirely. The user's reply
  // is resolved on the next turn via conversationState.pending.
  if (
    outputPlan.needsClarification &&
    outputPlan.clarificationQuestion &&
    !body.image?.data &&
    !resolved.resolvedFromPending
  ) {
    // Use polarity/troubleshooting visualType (not "text") so the existing
    // pending-state machinery in nextConversationState recognizes the question
    // and tracks the missing slot.
    const clarificationVisualType: VisualType =
      outputPlan.intent === "troubleshooting" ? "troubleshooting" : "polarity";
    const clarification: AgentResponse = {
      answer: outputPlan.clarificationQuestion,
      visualType: clarificationVisualType,
      process: outputPlan.process,
      refs: [],
      visuals: [],
      outputPlan
    };
    const conversationState = nextConversationState(question, clarification, body.conversationState, resolved);
    console.log("[chat] clarification short-circuit for intent:", outputPlan.intent);
    return NextResponse.json({
      ...clarification,
      conversationState,
      usedModel: "planner-clarification" as const,
      cacheKey
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const conversationState = nextConversationState(question, fallback, body.conversationState, resolved);
    const localImage = indexedVisual
      ? manualImages.find((image) => image.src === indexedVisual.imagePath)
      : undefined;
    const localResponse: AgentResponse = {
      ...fallback,
      manualImages: localImage ? [localImage] : fallback.manualImages
    };
    const localPlannedVisuals = planVisuals(question, Boolean(body.image?.data));
    const localVisuals = buildVisualsFromPlan(localPlannedVisuals, localResponse, question);
    const responseData = {
      ...localResponse,
      outputPlan,
      visuals: localVisuals,
      conversationState,
      usedModel: "local-fallback" as const,
      cacheKey,
      warning: "Local mode is on. Add ANTHROPIC_API_KEY to .env and restart to enable Claude image reasoning."
    };
    return NextResponse.json(responseData);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929";
  const hasImage = Boolean(body.image?.data);
  const intentKnowledge = getVisualKnowledgeForIntent(outputPlan.intent, outputPlan.slots);

  const prompt = [
    "You are a practical garage-side welding helper for the Vulcan OmniPro 220.",
    "",
    "ANSWER SCOPE (CRITICAL):",
    "- Answer ONLY the user's exact question. Do not pivot to generic process comparisons.",
    "- If the user asks about a specific process (e.g., TIG), answer about that process only.",
    "- Do NOT enumerate all four processes (MIG, flux-core, TIG, stick) unless the user explicitly asked to choose or compare.",
    `- Detected slots — process: ${outputPlan.slots.process}, voltage: ${outputPlan.slots.voltage ?? "unspecified"}, amperage: ${outputPlan.slots.amperage ?? "unspecified"}, topic: ${outputPlan.slots.topic ?? "unspecified"}.`,
    "",
    "GROUNDING RULES (CRITICAL):",
    "- Use ONLY facts from the retrieved manual context below. Do NOT invent ratings, page numbers, or setup values.",
    "- If the user asks for a specific value and it is not in the provided context, say 'The manual does not specify that' and provide what IS known.",
    "- Never use general welding knowledge that is not grounded in the provided context.",
    "- Do not guess at wire speeds, voltages, or amperage values. Always reference the manual or selection chart.",
    "- If you need clarification to answer accurately, ask one question at a time.",
    "",
    "TONE:",
    "- Write like you are helping someone in real time: conversational, direct, practical.",
    "- Never say phrases like 'the manual says', 'the manual specifies', or 'according to the manual'.",
    "- Use 'Got it.' as a transition before asking clarifying questions.",
    "",
    "FORMATTING:",
    "- First sentence MUST directly answer the user's question before any list or extra explanation.",
    "- Bold important cable/socket names: **ground clamp → negative (−)**",
    "- Use numbered steps: 1. First, 2. Then, etc. Maximum 3 steps unless the user asked for a full procedure.",
    "- Add at most one 'Tip: ...' or one warning. No long paragraphs.",
    "- Use 'Next:' to guide what to do after this task",
    "- Never return only raw tables/lists without a direct answer sentence first.",
    "- For duty-cycle responses, compute weld/rest time FIRST in the answer, then fill highlightContext.highlightKey as '<input>-<amperage>' and highlightContext.highlightLabel as '<weld> min weld / <rest> min rest'.",
    "- For polarity responses, fill highlightContext.emphasis with the key connection pair (example: 'Ground → +, Torch → −').",
    "- For process_selection, set recommendedProcess and explain WHY in one sentence (gas? outdoors? thickness? finish?).",
    "- For troubleshooting, return checklist[] of short imperative steps in cause→check→fix order.",
    "",
    "FACTS (from manual context below):",
    "- Flux-core: ground clamp → positive (+), wire feed cable → negative (−), no shielding gas",
    "- MIG: ground clamp → negative (−), wire feed cable → positive (+), shielding gas required",
    "- TIG: ground clamp → positive (+), TIG torch → negative (−), gas to regulator, foot pedal inside machine, wire feed disconnected",
    "- Stick: ground clamp → negative (−), electrode holder → positive (+), wire feed disconnected",
    "- Duty cycle 120V: 40% at 100A (4 min weld/6 min rest), 100% at 75A (10 min weld/0 rest)",
    "- Duty cycle 240V: 25% at 200A (2.5 min weld/7.5 min rest), 100% at 115A (10 min weld/0 rest)",
    "",
    "VISUAL KNOWLEDGE FACTS (from indexed manual images):",
    visualFacts.map((fact) => `- ${fact}`).join("\n"),
    "",
    intentKnowledge,
    "",
    hasImage
      ? [
        "IMAGE DIAGNOSIS MODE: The user uploaded an image \u2014 analyze it directly.",
        "- Do NOT ask generic clarification questions before diagnosing what you can see.",
        "- Start with the most likely visual diagnosis.",
        "- Compare what you see to the manual's weld diagnosis catalog: porosity, excessive spatter, wavy bead, burn-through, poor penetration, contamination.",
        "- State visible clues, likely causes, and the first checks to run.",
        "- Likely causes to consider: wrong polarity, dirty metal, contaminated wire, shielding gas issue (MIG only), CTWD/stickout/travel speed.",
        "- If uncertain, say so explicitly but still describe what is visible \u2014 never refuse to diagnose just because the photo isn't perfect.",
        "- Set visualType=\"image-diagnosis\" and fill imageDiagnosis with category, likelyIssue, visualClues, checks, fixes, and confidence."
      ].join("\n")
      : "IMAGE: No image is attached. Do NOT mention images, do NOT say 'I don't see an image', and do NOT ask for one.",
    "",
    responseJsonInstruction,
    "",
    `Planned intent: ${outputPlan.intent}`,
    `Planned visual type: ${outputPlan.visualType}`,
    `Planned visual id: ${outputPlan.visualId ?? "none"}`,
    `Detected visual type: ${context.visualType}`,
    `Detected process: ${context.process}`,
    `Agent SDK retrieval tools available in this app: ${agentToolNames.join(", ")}`,
    "",
    "Retrieved manual context (use ONLY these facts):",
    context.snippets.map((snippet) => `- ${snippet}`).join("\n"),
    "References:",
    context.refs.map((ref) => `- ${ref.source}: ${ref.title} (${ref.url})`).join("\n"),
    "",
    body.conversationState?.pending
      ? `Clarification state: waiting for ${body.conversationState.pending.missing}. Known so far -> process: ${body.conversationState.pending.process ?? "unknown"}, material: ${body.conversationState.pending.material ?? "unknown"}, thickness: ${body.conversationState.pending.thickness ?? "unknown"}.`
      : "",
    resolved.resolvedFromPending ? `Conversation note: the latest user message "${rawQuestion}" answered the previous clarification. Continue the original question with the resolved detail.` : "",
    `User question: ${question}`
  ].join("\n");

  const content: Anthropic.MessageParam["content"] = [{ type: "text", text: prompt }];
  if (body.image?.data) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: body.image.mediaType,
        data: body.image.data
      }
    });
  }

  // Temporary debug logging for image-diagnosis routing. Never logs the full
  // base64 payload \u2014 only its length so we can confirm it reached the API.
  const hasImageBlock = content.some((b) => b.type === "image");
  console.log("[chat] imagePresent:", Boolean(body.image?.data));
  if (body.image?.data) {
    console.log("[chat] imageMediaType:", body.image.mediaType);
    console.log("[chat] base64Length:", body.image.data.length);
  }
  console.log("[chat] intent:", outputPlan.intent);
  console.log("[chat] claudeContentIncludesImageBlock:", hasImageBlock);

  try {
    let imageDiagnosis: AgentResponse["imageDiagnosis"] | undefined;
    if (body.image?.data && outputPlan.needsClaudeVision) {
      imageDiagnosis = await analyzeUploadedImage(client, model, body.image.data, body.image.mediaType, question);
    }

    const callClaude = (extraInstruction?: string) => {
      const finalContent: Anthropic.MessageParam["content"] = extraInstruction
        ? [{ type: "text", text: `${prompt}\n\nIMPORTANT: ${extraInstruction}` }, ...content.slice(1)]
        : content;
      return client.messages.create({
        model,
        max_tokens: 2000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: finalContent }]
      });
    };

    let message = await callClaude();
    let text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    let parsedJson = extractJson(text);
    let answerText: string = typeof parsedJson?.answer === "string" ? parsedJson.answer : text;

    // Generic-response guard: if Claude returned a multi-process comparison
    // for what should be a specific question, retry once with a corrective
    // instruction.
    if (isGenericMultiProcessAnswer(answerText) && outputPlan.intent !== "process_selection") {
      message = await callClaude(
        "Answer only the specific question. Do not compare all processes. Stay focused on what the user actually asked."
      );
      text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      parsedJson = extractJson(text);
      answerText = typeof parsedJson?.answer === "string" ? parsedJson.answer : text;
    }

    const parsed = AgentResponseSchema.partial().safeParse(parsedJson);
    const response = normalizeAgentResponse(question, parsed.success ? parsed.data : undefined);
    const linkedManual = indexedVisual ? manualImages.find((img) => img.src === indexedVisual.imagePath) : undefined;
    if (linkedManual && !response.manualImages?.length) {
      response.manualImages = [linkedManual];
    }
    response.outputPlan = outputPlan;
    // Enforce planner-driven visual selection so the workspace cannot show a
    // stale or mismatched visual from a previous turn or from the model.
    response.visualType = plannerVisualToUi[outputPlan.visualType];
    if (outputPlan.visualType === "image_diagnosis_panel") {
      if (imageDiagnosis) {
        response.imageDiagnosis = imageDiagnosis;
        // If Claude fell back to the generic clarification text, replace it
        // with a real diagnosis composed from the imageDiagnosis payload so
        // the user always sees a focused answer when an image is attached.
        if (isGenericClarificationFallback(response.answer)) {
          console.log("[chat] generic fallback detected with image \u2014 substituting imageDiagnosis answer");
          response.answer = composeImageDiagnosisAnswer(imageDiagnosis);
        }
        // Derive cause/check/fix items from the live diagnosis so the
        // troubleshooting flow shows what was actually seen, not a generic
        // catalog default.
        if (!response.troubleshootingItems?.length) {
          response.troubleshootingItems = troubleshootingItemsFromDiagnosis(imageDiagnosis);
        }
      }
      if (!response.answer.toLowerCase().includes("can’t confirm") && !response.answer.toLowerCase().includes("cannot confirm")) {
        response.answer = `${response.answer}\n\nCommon mistake:\n- Over-trusting one photo. Verify polarity, shielding/feed, and clean metal before changing technique.\n\nNext:\n1. Run the checks listed in the diagnosis panel.\n2. Make a short test bead.\n3. Share a clearer close-up if results are still inconsistent.`;
      }
    }
    if (indexedVisual && !response.refs.some((ref) => ref.title === indexedVisual.title)) {
      response.refs = [...response.refs, getManualImageRef(indexedVisual)];
    }
    if (outputPlan.intent === "troubleshooting" && !response.troubleshootingItems?.length) {
      response.troubleshootingItems = getTroubleshootingItems(question, outputPlan.slots.process);
    }
    // Always rebuild the visuals[] from the live plan so the workspace cannot
    // carry a stale visual from a prior turn.
    const plannedVisuals = planVisuals(question, Boolean(body.image?.data));
    response.visuals = buildVisualsFromPlan(plannedVisuals, response, question);
    const conversationState = nextConversationState(question, response, body.conversationState, resolved);

    return NextResponse.json({
      ...response,
      conversationState,
      usedModel: model,
      cacheKey
    });
  } catch (error) {
    console.error(error);
    const fallbackPlannedVisuals = planVisuals(question, Boolean(body.image?.data));
    const fallbackVisuals = buildVisualsFromPlan(fallbackPlannedVisuals, fallback, question);
    const conversationState = nextConversationState(question, fallback, body.conversationState, resolved);
    return NextResponse.json(
      {
        ...fallback,
        visuals: fallbackVisuals,
        outputPlan,
        conversationState,
        usedModel: "local-fallback",
        cacheKey,
        warning: "Claude was unavailable, so I used the built-in setup data."
      },
      { status: 200 }
    );
  }
}

async function analyzeUploadedImage(
  client: Anthropic,
  model: string,
  imageData: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  question: string
): Promise<AgentResponse["imageDiagnosis"]> {
  const diagnosisCatalog = weldDiagnosisKnowledge
    .map((d) => `- ${d.defect}: cues=[${d.visualCues.join("; ")}]; causes=[${d.likelyCauses.join("; ")}]; fixes=[${d.fixes.join("; ")}]`)
    .join("\n");
  const prompt = `Classify this welding-related image. Compare what you see against the known defect catalog below and return only compact JSON.

Known defect catalog (match cues, then borrow likelyIssue/checks/fixes wording):
${diagnosisCatalog}

JSON shape:
{
  "category": "weld_bead_defect|wiring_setup|front_panel|wire_feed|unknown",
  "likelyIssue": "...",
  "visualClues": ["..."],
  "checks": ["..."],
  "fixes": ["..."],
  "confidence": "low|medium|high",
  "caution": "optional"
}
If unclear, set category=unknown, confidence=low, and caution="I can\u2019t confirm from this image, but here are the checks I\u2019d run first."
User question: ${question}`;

  const message = await client.messages.create({
    model,
    max_tokens: 500,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageData }
          }
        ]
      }
    ]
  });
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const parsed = extractJson(text) as AgentResponse["imageDiagnosis"] | undefined;
  if (!parsed) {
    return {
      category: "unknown",
      likelyIssue: "Image is unclear for confident diagnosis",
      visualClues: ["Limited visual detail", "Angle/lighting makes fault pattern unclear"],
      checks: ["Confirm polarity wiring", "Check gas/feed setup", "Clean and re-test on scrap"],
      fixes: ["Retake close-up image with better lighting"],
      confidence: "low",
      caution: "I can’t confirm from this image, but here are the checks I’d run first."
    };
  }
  return parsed;
}
