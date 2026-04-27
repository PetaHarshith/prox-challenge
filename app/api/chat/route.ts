import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AgentResponseSchema, localGroundedResponse, normalizeAgentResponse, type AgentResponse } from "@/lib/agentResponse";
import { agentToolNames } from "@/lib/claudeAgent";
import { nextConversationState, resolveConversationalQuestion, type ConversationState } from "@/lib/conversationState";
import { retrieveManualContext, manualImages } from "@/lib/manualKnowledge";
import { findManualImageById, getManualImageRef } from "@/lib/manualImageIndex";
import { planOutput, structuredCacheKey, type PlannerVisualType } from "@/lib/outputPlanner";
import type { VisualType } from "@/lib/manualKnowledge";
import {
  getTroubleshootingItems,
  getVisualKnowledgeForIntent,
  weldDiagnosisKnowledge
} from "@/lib/manualVisualKnowledge";

export const runtime = "nodejs";

// Strict system prompt: every response must answer the user's exact question
// without falling back to multi-process comparisons.
const systemPrompt = [
  "You are a welding assistant for the Vulcan OmniPro 220.",
  "Answer ONLY the user's exact question. Do not give general comparisons unless asked.",
  "Be specific, practical, and correct.",
  "If the user asks about TIG, answer about TIG only. If they ask about flux-core, answer about flux-core only.",
  "Never list all four processes (MIG, flux-core, TIG, stick) unless the user explicitly asked to choose or compare.",
  "Only mention an uploaded image if the user explicitly attached one or referenced it in this turn."
].join("\n");

// Detects the generic "Use MIG / TIG / flux-core" comparison block when the
// user asked a specific question.
function isGenericMultiProcessAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  if (!/use mig if|use mig for|use mig when/.test(lower)) return false;
  const processCount = ["mig", "tig", "flux", "stick"].filter((p) => lower.includes(p)).length;
  return processCount >= 3;
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
  "answer": "Detailed step-by-step guidance in plain language, formatted with **bold** for important terms, numbered steps, tips, and next steps",
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
}`;

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

  if (!process.env.ANTHROPIC_API_KEY) {
    const conversationState = nextConversationState(question, fallback, body.conversationState, resolved);
    const localImage = indexedVisual
      ? manualImages.find((image) => image.src === indexedVisual.imagePath)
      : undefined;
    const responseData = {
      ...fallback,
      outputPlan,
      manualImages: localImage ? [localImage] : fallback.manualImages,
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
      ? "IMAGE: The user uploaded an image. Look at it, match cues against the WELD DIAGNOSIS KNOWLEDGE above, and explain likely issue + why + fix."
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
        max_tokens: 1200,
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
      }
      if (!response.answer.toLowerCase().includes("can’t confirm") && !response.answer.toLowerCase().includes("cannot confirm")) {
        response.answer = `${response.answer}\n\nCommon mistake:\n- Over-trusting one photo. Verify polarity, shielding/feed, and clean metal before changing technique.\n\nNext:\n1. Run the checks listed in the diagnosis panel.\n2. Make a short test bead.\n3. Share a clearer close-up if results are still inconsistent.`;
      }
    }
    if (indexedVisual && !response.refs.some((ref) => ref.title === indexedVisual.title)) {
      response.refs = [...response.refs, getManualImageRef(indexedVisual)];
    }
    if (outputPlan.intent === "troubleshooting" && !response.troubleshootingItems?.length) {
      response.troubleshootingItems = getTroubleshootingItems(question);
    }
    const conversationState = nextConversationState(question, response, body.conversationState, resolved);

    return NextResponse.json({
      ...response,
      conversationState,
      usedModel: model,
      cacheKey
    });
  } catch (error) {
    console.error(error);
    const conversationState = nextConversationState(question, fallback, body.conversationState, resolved);
    return NextResponse.json(
      {
        ...fallback,
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
