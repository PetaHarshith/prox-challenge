"use client";

import { type CSSProperties, FormEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Cpu, Eye, ImagePlus, Send, ShieldAlert, Wand2, X } from "lucide-react";
import { SourceChips } from "@/components/SourceChips";
import { MarkdownContent } from "@/components/MarkdownContent";
import { VisualWorkspace } from "@/components/VisualWorkspace";
import { QuickSetupForm } from "@/components/QuickSetupForm";
import { TroubleshootingFlow } from "@/components/TroubleshootingFlow";
import { PreWeldChecklist } from "@/components/PreWeldChecklist";
import { PreWeldChecklistPager, type PreWeldChecklistEntry } from "@/components/PreWeldChecklistPager";
import { SetupComparisonTable } from "@/components/SetupComparisonTable";
import { MicButton } from "@/components/MicButton";
import { FaultCodeBrowser } from "@/components/FaultCodeBrowser";
import { FaultCodeCard } from "@/components/FaultCodeCard";
import { hasWorkspaceVisuals, type VisualSpec } from "@/lib/agentResponse";
import type { ConversationState } from "@/lib/conversationState";
import type { CachedResponseData } from "@/lib/prebuiltAnswers";
import { recommendFromAnswers, type QuickSetupAnswers } from "@/lib/quickSetup";
import type { FaultCode } from "@/lib/faultCodes";
import { stripInlineMarkdown } from "@/lib/textFormat";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  response?: CachedResponseData;
  // Set when the turn was synthesized from the Fault Code browser. Renders a
  // FaultCodeCard inline below the prose; no LLM call is made for these turns.
  faultCode?: FaultCode;
};



// Pulls the troubleshooting flow data for inline chat rendering. Prefers the
// planner-built spec; falls back to legacy response fields when the older
// shape (visualType="troubleshooting" + troubleshootingItems) is in play.
function pickTroubleshootingFlow(
  response: CachedResponseData | undefined,
  symptomFallback: string
): { items?: { cause: string; check: string; fix: string }[]; checklist?: string[]; symptom: string } | undefined {
  if (!response) return undefined;
  const spec = response.visuals?.find((v) => v.kind === "troubleshooting_flow");
  if (spec && spec.kind === "troubleshooting_flow") {
    return { items: spec.items, checklist: spec.checklist, symptom: spec.symptom ?? symptomFallback };
  }
  if (response.visualType === "troubleshooting" && (response.troubleshootingItems?.length || response.checklist?.length)) {
    return { items: response.troubleshootingItems, checklist: response.checklist, symptom: symptomFallback };
  }
  return undefined;
}

function pickPreWeldChecklist(response: CachedResponseData | undefined) {
  const spec = response?.visuals?.find((v) => v.kind === "pre_weld_checklist");
  return spec && spec.kind === "pre_weld_checklist" ? spec : undefined;
}

// Collects every pre_weld_checklist the server emitted (in order). When the
// list has 2+ entries the chat bubble renders the PreWeldChecklistPager so
// the user can flip between per-process checklists with arrows instead of
// scrolling through a stacked wall of them.
function pickAllPreWeldChecklists(response: CachedResponseData | undefined): PreWeldChecklistEntry[] {
  if (!response?.visuals?.length) return [];
  const seen = new Set<string>();
  const out: PreWeldChecklistEntry[] = [];
  for (const v of response.visuals) {
    if (v.kind === "pre_weld_checklist" && !seen.has(v.process)) {
      seen.add(v.process);
      out.push({ process: v.process, items: v.items, title: v.title });
    }
  }
  return out;
}

// Collects every process the server emitted a setup_diagram for. When the
// list has 2+ entries the user asked about multiple setups, so the inline
// SetupComparisonTable mounts below the prose.
function pickSetupComparisonProcesses(response: CachedResponseData | undefined) {
  if (!response?.visuals?.length) return [] as Array<"mig" | "flux-core" | "tig" | "stick">;
  const seen = new Set<string>();
  const out: Array<"mig" | "flux-core" | "tig" | "stick"> = [];
  for (const v of response.visuals) {
    if (v.kind === "setup_diagram" && !seen.has(v.process)) {
      seen.add(v.process);
      out.push(v.process);
    }
  }
  return out;
}

// Builds a synthetic assistant response from the Quick Setup form so the
// workspace gets a setup diagram + pre-weld checklist (and any deterministic
// warnings) without an LLM call. Reuses the existing AgentResponse + VisualSpec
// shapes so visual history and the workspace renderer keep working unchanged.
function buildQuickSetupResponse(answers: QuickSetupAnswers): { question: string; response: CachedResponseData } {
  const rec = recommendFromAnswers(answers);
  const proc = rec.process;
  const processLabel: Record<typeof proc, string> = {
    mig: "MIG",
    "flux-core": "Flux-core",
    tig: "TIG",
    stick: "Stick"
  };
  const summary = [
    `Recommended process: **${processLabel[proc]}**.`,
    "",
    rec.why,
    "",
    `**Wiring:** ${rec.wiring}`,
    `**Gas:** ${rec.gas}`,
    "",
    `**Next:** ${rec.next}`,
    rec.dutyNote ? `\n_${rec.dutyNote}_` : "",
    rec.followUp ? `\n${rec.followUp}` : ""
  ].filter(Boolean).join("\n");

  const visuals: VisualSpec[] = [
    { kind: "setup_diagram", process: proc },
    { kind: "pre_weld_checklist", process: proc, title: `${processLabel[proc]} pre-weld checklist` }
  ];

  const question = `Quick Setup: ${answers.location}, ${answers.hasGas === "yes" ? "with gas" : "no gas"}, ${answers.material}, ${answers.thickness}.`;
  const response: CachedResponseData = {
    answer: summary,
    visualType: "polarity",
    process: proc,
    refs: [],
    visuals,
    usedModel: "quick-setup"
  };
  return { question, response };
}

// Synthesises a chat turn from a fault picked in the FaultCodeBrowser. No LLM
// call: the answer is a one-line lead-in and the FaultCodeCard renders the
// rich detail. visualType is "text" so nothing extra mounts in the workspace.
function buildFaultCodeResponse(fault: FaultCode): { question: string; response: CachedResponseData } {
  const question = `What does the "${fault.label}" indicator mean and how do I recover?`;
  const answer = `Here's what the **${fault.code}** indicator means on your OmniPro 220, and the steps to recover.`;
  const response: CachedResponseData = {
    answer,
    visualType: "text",
    process: "unknown",
    refs: fault.refs,
    usedModel: "fault-code-browser"
  };
  return { question, response };
}

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const suggestionChips = [
  {
    label: "Outdoors, no gas, 200A",
    prompt:
      "I'm welding 1/8 steel outdoors with no gas at 200A on 240V. Which process should I use, how should I wire it, and how long can I weld?"
  },
  {
    label: "Flux-core porosity",
    prompt: "My flux-core welds have pinholes and look porous. What's wrong?"
  },
  {
    label: "Duty cycle 200A/240V",
    prompt: "If I'm running 200A on 240V, how long can I weld?"
  },
  {
    label: "Flux-core cables",
    prompt: "I'm setting up flux-core outdoors with no gas. Where exactly do my cables go?"
  }
];

function loadingTextFor(question?: string, hasImage?: boolean) {
  if (hasImage) return "Looking over the image...";
  const text = question?.toLowerCase() ?? "";
  if (/\bduty\b|\bhow long\b|\bcontinuous|overheat|thermal|200\s*a|240\s*v|120\s*v/.test(text)) {
    return "Checking weld time and cooldown...";
  }
  if (/\bpolarity|setup|set ?up|cable|ground|torch|wire feed|electrode|connect|plug|hook/.test(text)) {
    return "Mapping the cable setup...";
  }
  if (/\bporosity|spatter|pinholes?|wrong|bad weld|troubleshoot|burn|feed|bird.?nest/.test(text)) {
    return "Tracing the likely cause...";
  }
  if (/\bwhich process|what process|choose|compare|outdoors|no gas|material|thickness/.test(text)) {
    return "Picking the best process...";
  }
  return "Working through the answer...";
}

// Client-side session cache (cleared on page reload)
const clientCache = new Map<string, CachedResponseData>();

function generateCacheKey(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mediaType = header.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  return { data, mediaType: acceptedImageTypes.includes(mediaType as (typeof acceptedImageTypes)[number]) ? mediaType : "image/jpeg" };
}

export default function Home() {
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm here to help you set up, troubleshoot, and optimize your Vulcan OmniPro 220. Ask me about cable polarity, duty cycles, wire loading, process selection, or weld quality. I'll guide you step-by-step with practical tips and reference diagrams."
    }
  ]);
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPrompt, setLoadingPrompt] = useState<{ text: string; hasImage: boolean }>();
  const [conversationState, setConversationState] = useState<ConversationState>({});
  // Holds the planner-driven preview response while Claude is still
  // generating, so the visual workspace can swap from skeleton to the right
  // diagrams once the first answer delta lands. Stays undefined while the
  // workspace is still in skeleton mode so the transition is gated on real
  // streaming output, not the planning phase.
  const [streamingResponse, setStreamingResponse] = useState<CachedResponseData | undefined>(undefined);
  // Tracks the assistant turn whose JSON tail is still arriving so the chat
  // bubble can show a "writing" indicator until the entire payload (answer +
  // reasoning_summary / "Why this answer" + refs) has landed via `complete`.
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  // Lightweight visual history: when the user clicks "View visual" on an older
  // assistant message, pin its turn id so the workspace shows that message's
  // saved visual payload. Cleared whenever a fresh assistant response arrives
  // so the latest answer always wins by default.
  const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [faultBrowserOpen, setFaultBrowserOpen] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(520);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRequestController = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function startWorkspaceResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = workspaceWidth;

    function onPointerMove(moveEvent: PointerEvent) {
      const nextWidth = startWidth + startX - moveEvent.clientX;
      const maxWidth = Math.min(820, window.innerWidth - 520);
      setWorkspaceWidth(Math.min(Math.max(nextWidth, 380), Math.max(maxWidth, 420)));
    }

    function onPointerUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function handleQuickSetupSubmit(answers: QuickSetupAnswers) {
    const { question, response } = buildQuickSetupResponse(answers);
    setTurns((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: crypto.randomUUID(), role: "assistant", content: response.answer, response }
    ]);
    setQuickSetupOpen(false);
  }

  function handleFaultSelect(fault: FaultCode) {
    const { question, response } = buildFaultCodeResponse(fault);
    setTurns((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        response,
        faultCode: fault
      }
    ]);
    setFaultBrowserOpen(false);
  }

  const apiMessages = useMemo(
    () =>
      turns
        .filter((turn) => turn.id !== "welcome")
        .map((turn) => ({ role: turn.role, content: turn.content }))
        .slice(-8),
    [turns]
  );

  const latestAssistantTurn = useMemo(
    () => [...turns].reverse().find((turn) => turn.role === "assistant" && turn.response),
    [turns]
  );

  const latestResponse = latestAssistantTurn?.response;

  const latestUserQuestion = useMemo(
    () => [...turns].reverse().find((turn) => turn.role === "user")?.content,
    [turns]
  );

  // Auto-clear the pin whenever a new assistant response arrives so the
  // workspace snaps back to the newest visual on the next turn.
  const previousLatestAssistantId = useRef(latestAssistantTurn?.id);
  useEffect(() => {
    if (previousLatestAssistantId.current !== latestAssistantTurn?.id) {
      previousLatestAssistantId.current = latestAssistantTurn?.id;
      setPinnedTurnId(null);
    }
  }, [latestAssistantTurn?.id]);

  const pinnedTurn = useMemo(
    () => (pinnedTurnId ? turns.find((turn) => turn.id === pinnedTurnId) : undefined),
    [pinnedTurnId, turns]
  );

  // While streaming, the in-flight preview takes priority over any prior
  // turn's response so the workspace updates with the new question's visuals
  // immediately instead of holding stale ones from the previous answer.
  const displayedResponse = pinnedTurn?.response ?? streamingResponse ?? latestResponse;

  // When viewing a pinned visual, also surface the user question that produced
  // it so components like TroubleshootingFlow show the matching symptom header.
  const displayedUserQuestion = useMemo(() => {
    if (!pinnedTurnId) return latestUserQuestion;
    const idx = turns.findIndex((turn) => turn.id === pinnedTurnId);
    if (idx <= 0) return latestUserQuestion;
    for (let i = idx - 1; i >= 0; i--) {
      if (turns[i].role === "user") return turns[i].content;
    }
    return latestUserQuestion;
  }, [pinnedTurnId, turns, latestUserQuestion]);

  async function submitPrompt(prompt: string) {
    if (!prompt.trim() || isLoading) return;

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      imagePreview
    };

    setTurns((current) => [...current, userTurn]);
    setLoadingPrompt({ text: prompt.trim(), hasImage: Boolean(imagePreview) });
    setInput("");
    setImagePreview(undefined);
    setUploadError(undefined);
    setIsLoading(true);

    const image = imagePreview ? splitDataUrl(imagePreview) : undefined;
    const cacheKey = generateCacheKey(prompt.trim());

    // Check client cache first (only if no image uploaded)
    if (!image) {
      const cached = clientCache.get(cacheKey);
      if (cached) {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: cached.answer,
            response: { ...cached, cacheHit: true }
          }
        ]);
        setConversationState(cached.conversationState ?? {});
        setIsLoading(false);
        return;
      }
    }

    try {
      const controller = new AbortController();
      activeRequestController.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...apiMessages, { role: "user", content: prompt.trim() }],
          conversationState,
          image
        })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantTurnId: string | null = null;
      let accumulatedText = "";
      let previewResponse: CachedResponseData | undefined;
      let answerDone = false;

      // Auto-scroll on every delta so the latest streamed text stays in view.
      // Uses requestAnimationFrame + instant scroll so it tracks the stream
      // without smooth-scroll fighting itself on rapid updates.
      const scrollToBottom = () => {
        if (typeof window === "undefined") return;
        window.requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let event: { type: string; response?: CachedResponseData; delta?: string };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "preview" && event.response) {
            // Hold the preview locally — the workspace stays in skeleton
            // until the first answer delta lands so the visual transition
            // and the streaming text appear together, not separately.
            previewResponse = event.response;
          } else if (event.type === "answer_delta" && typeof event.delta === "string") {
            const delta = event.delta;
            if (!assistantTurnId) {
              const id = crypto.randomUUID();
              assistantTurnId = id;
              accumulatedText = delta;
              setIsLoading(false);
              setLoadingPrompt(undefined);
              setStreamingResponse(previewResponse);
              setStreamingTurnId(id);
              const turnResponse = previewResponse ? { ...previewResponse, answer: delta } : undefined;
              setTurns((current) => [
                ...current,
                { id, role: "assistant", content: delta, response: turnResponse }
              ]);
            } else {
              accumulatedText += delta;
              const text = accumulatedText;
              const id = assistantTurnId;
              setTurns((current) =>
                current.map((t) => (t.id === id ? { ...t, content: text } : t))
              );
            }
            scrollToBottom();
          } else if (event.type === "answer_done") {
            // Claude has finished the answer text but is still emitting the
            // JSON tail (visualType, refs, etc.). The streamed bubble can
            // settle now — preview already carries the source chips, so the
            // user sees a complete-looking response while metadata finalizes.
            answerDone = true;
          } else if (event.type === "answer_reset") {
            // Server is retrying — clear the streamed-so-far text and wait
            // for the final `complete` event to provide the corrected answer.
            accumulatedText = "";
            answerDone = false;
            if (assistantTurnId) {
              const id = assistantTurnId;
              setTurns((current) =>
                current.map((t) => (t.id === id ? { ...t, content: "" } : t))
              );
            }
          } else if (event.type === "complete" && event.response) {
            const data = event.response;
            if (!image) clientCache.set(cacheKey, data);
            setConversationState(data.conversationState ?? {});
            if (assistantTurnId) {
              const id = assistantTurnId;
              // If the streamed text already matches the final answer (the
              // common case), keep the streamed content as-is and only attach
              // the full response payload. Avoids a visible reflow where the
              // bubble briefly re-renders identical text on completion.
              const textMatches = answerDone && accumulatedText === data.answer;
              setTurns((current) =>
                current.map((t) =>
                  t.id === id
                    ? { ...t, content: textMatches ? t.content : data.answer, response: data }
                    : t
                )
              );
            } else {
              setTurns((current) => [
                ...current,
                { id: crypto.randomUUID(), role: "assistant", content: data.answer, response: data }
              ]);
            }
            // Clear the writing indicator only now — the entire payload
            // (answer + reasoning_summary + refs) has landed.
            setStreamingTurnId(null);
            scrollToBottom();
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Stopped. Send another prompt whenever you are ready."
          }
        ]);
        return;
      }
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I could not reach the local chat route. Check that the dev server is running and try again."
        }
      ]);
    } finally {
      activeRequestController.current = null;
      setIsLoading(false);
      setLoadingPrompt(undefined);
      setStreamingResponse(undefined);
      setStreamingTurnId(null);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, isLoading]);

  function stopPrompt() {
    activeRequestController.current?.abort();
    activeRequestController.current = null;
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) {
      setUploadError("Use a JPG, PNG, WebP, or GIF image.");
      return;
    }
    setUploadError(undefined);
    setImagePreview(await readFileAsDataUrl(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitPrompt(input);
  }

  return (
    <main className="relative flex h-screen min-h-[720px] flex-col overflow-hidden bg-[radial-gradient(circle_at_32%_18%,rgba(123,174,36,0.1),transparent_58%),#F4F2EC] text-text-primary">
      <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-black/[0.08] bg-[#F8F7F2]/90 px-5 text-text-primary backdrop-blur-md">
        <div className="relative z-10 flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-[#171A1F] text-brass">
            <Cpu size={16} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-sage" />
          </div>
          <div className="min-w-0 leading-none">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold text-text-primary">OmniPro 220</h1>
              <span className="hidden rounded-full border border-black/[0.08] bg-card px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-secondary sm:inline-flex">
                WeldOps Agent
              </span>
            </div>
            <p className="mt-1 hidden truncate text-[11px] text-text-secondary sm:block">Vulcan setup, troubleshooting, and visual guidance</p>
          </div>
        </div>
        <div className="relative z-10 hidden items-center gap-2 sm:flex">
          <span className="rounded-full border border-black/[0.08] bg-card px-2.5 py-1 text-xs font-medium text-text-secondary">
            Manual grounded
          </span>
          <span className="rounded-full border border-black/[0.08] bg-card px-2.5 py-1 text-xs font-medium text-text-secondary">
            Visual workspace
          </span>
        </div>
      </header>

      <div
        className="relative z-10 grid min-h-0 flex-1 xl:[grid-template-columns:minmax(0,1fr)_var(--workspace-width)]"
        style={{ "--workspace-width": `${workspaceWidth}px` } as CSSProperties}
      >
        <section className="flex min-h-0 flex-col bg-transparent">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {turns.map((turn, idx) => {
                const turnHasVisuals = turn.role === "assistant" && hasWorkspaceVisuals(turn.response);
                const isPinned = pinnedTurnId === turn.id;
                const isLatestAssistant = turn.id === latestAssistantTurn?.id;
                // Walk back to the user message that produced this assistant
                // turn so the inline troubleshooting flow can show the symptom.
                const priorUserContent =
                  turn.role === "assistant"
                    ? [...turns.slice(0, idx)].reverse().find((t) => t.role === "user")?.content ?? ""
                    : "";
                // Hide the inline checklists while the answer is still
                // streaming so the prose finishes first; they fade in once the
                // bubble settles.
                const isStreamingThisTurn = turn.id === streamingTurnId;
                const troubleFlow =
                  turn.role === "assistant" && !isStreamingThisTurn
                    ? pickTroubleshootingFlow(turn.response, priorUserContent)
                    : undefined;
                const preWeldEntries =
                  turn.role === "assistant" && !isStreamingThisTurn ? pickAllPreWeldChecklists(turn.response) : [];
                const preWeldSpec =
                  preWeldEntries.length === 1
                    ? preWeldEntries[0]
                    : preWeldEntries.length === 0 && turn.role === "assistant" && !isStreamingThisTurn
                      ? pickPreWeldChecklist(turn.response)
                      : undefined;
                const setupComparisonProcesses =
                  turn.role === "assistant" && !isStreamingThisTurn
                    ? pickSetupComparisonProcesses(turn.response)
                    : [];
                return (
                  <article key={turn.id} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        turn.role === "user"
                          ? "max-w-[82%] rounded-xl border border-black/[0.08] bg-[#171A1F] px-4 py-3 text-sm font-medium text-white"
                          : `max-w-[88%] rounded-xl border bg-card px-4 py-3 text-text-primary ${isPinned ? "border-brass/60 ring-1 ring-brass/20" : "border-black/[0.08]"}`
                      }
                    >
                      {turn.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">{turn.content}</p>
                      ) : (
                        <MarkdownContent content={turn.content} />
                      )}
                      {setupComparisonProcesses.length >= 2 ? (
                        <div
                          className="mt-3 animate-[checklist-in_420ms_ease-out_both]"
                          style={{ animationDelay: "120ms" }}
                        >
                          <SetupComparisonTable processes={setupComparisonProcesses} />
                        </div>
                      ) : null}
                      {troubleFlow ? (
                        <div
                          className="mt-3 animate-[checklist-in_420ms_ease-out_both]"
                          style={{ animationDelay: "120ms" }}
                        >
                          <TroubleshootingFlow
                            steps={troubleFlow.checklist}
                            items={troubleFlow.items}
                            symptom={troubleFlow.symptom}
                          />
                        </div>
                      ) : null}
                      {preWeldEntries.length >= 2 ? (
                        <div
                          className="mt-3 animate-[checklist-in_420ms_ease-out_both]"
                          style={{ animationDelay: troubleFlow ? "260ms" : "120ms" }}
                        >
                          <PreWeldChecklistPager entries={preWeldEntries} />
                        </div>
                      ) : preWeldSpec ? (
                        <div
                          className="mt-3 animate-[checklist-in_420ms_ease-out_both]"
                          style={{ animationDelay: troubleFlow ? "260ms" : "120ms" }}
                        >
                          <PreWeldChecklist
                            process={preWeldSpec.process}
                            items={preWeldSpec.items}
                            title={preWeldSpec.title}
                          />
                        </div>
                      ) : null}
                      {turn.faultCode ? (
                        <div
                          className="mt-3 animate-[checklist-in_420ms_ease-out_both]"
                          style={{ animationDelay: "120ms" }}
                        >
                          <FaultCodeCard fault={turn.faultCode} />
                        </div>
                      ) : null}
                      {turn.id === streamingTurnId ? (
                        <div className="mt-2 inline-flex items-center gap-2 text-xs text-text-secondary">
                          <span className="flex items-end gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brass" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage [animation-delay:120ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember [animation-delay:240ms]" />
                          </span>
                          <span>Writing…</span>
                        </div>
                      ) : null}
                      {turn.imagePreview ? (
                        <Image src={turn.imagePreview} alt="Uploaded question context" width={360} height={240} className="mt-3 rounded-xl border border-black/[0.08]" />
                      ) : null}
                      {turn.response?.highlights?.warning ? (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ember/35 bg-ember/10 px-2.5 py-1 text-xs font-medium text-ember">
                          <span aria-hidden>⚠</span>
                          <span>{stripInlineMarkdown(turn.response.highlights.warning)}</span>
                        </div>
                      ) : null}
                      {turn.response?.refs?.length && !turn.faultCode ? (
                        <div className="mt-3">
                          <SourceChips refs={turn.response.refs} />
                        </div>
                      ) : null}
                      {turn.response?.reasoning_summary ? (
                        <details className="mt-3 text-xs text-text-secondary">
                          <summary className="cursor-pointer select-none font-medium text-text-secondary hover:text-text-primary">Why this answer</summary>
                          <p className="mt-1.5 leading-5 text-text-secondary">{turn.response.reasoning_summary}</p>
                        </details>
                      ) : null}
                      {turn.response?.warning ? <p className="mt-3 text-xs text-ember">{stripInlineMarkdown(turn.response.warning)}</p> : null}
                      {turnHasVisuals && !isLatestAssistant ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setPinnedTurnId(isPinned ? null : turn.id)}
                            aria-pressed={isPinned}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${isPinned ? "border-brass/60 bg-brass/20 text-text-primary" : "border-black/[0.08] bg-card-soft text-text-secondary hover:text-text-primary"}`}
                          >
                            <Eye size={13} />
                            {isPinned ? "Viewing visual" : "View visual"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {isLoading ? (
                <ThinkingBubble label={loadingTextFor(loadingPrompt?.text, loadingPrompt?.hasImage)} />
              ) : null}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-black/[0.08] bg-[#F4F2EC]/95 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-xl border border-black/[0.08] bg-card p-3 shadow-panel">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setQuickSetupOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-brass px-3.5 py-1.5 text-xs font-semibold text-[#171A1F] hover:bg-[#A7EA32] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[#171A1F]">
                      <Wand2 size={12} />
                    </span>
                    Quick Setup
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setFaultBrowserOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-ember/40 bg-ember/10 px-3.5 py-1.5 text-xs font-semibold text-ember hover:bg-ember/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ember/15 text-ember">
                      <ShieldAlert size={12} />
                    </span>
                    Fault Codes
                  </button>
                  {suggestionChips.slice(0, 3).map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitPrompt(chip.prompt)}
                      className="rounded-full border border-black/[0.08] bg-card-soft px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-black/15 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {imagePreview ? (
                  <div className="mb-3 flex items-center gap-3 rounded-lg border border-black/[0.08] bg-card-soft p-2">
                    <Image src={imagePreview} alt="Upload preview" width={70} height={52} className="h-12 w-16 rounded object-cover" />
                    <span className="flex-1 text-sm text-text-secondary">Image attached</span>
                    <button type="button" onClick={() => setImagePreview(undefined)} className="rounded-md p-2 text-text-secondary hover:bg-black/5 hover:text-text-primary" aria-label="Remove image">
                      <X size={16} />
                    </button>
                  </div>
                ) : null}

                {uploadError ? <p className="mb-3 text-sm text-ember">{uploadError}</p> : null}

                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-card-soft text-text-secondary hover:text-text-primary"
                    aria-label="Attach image"
                  >
                    <ImagePlus size={20} />
                  </button>
                  <MicButton
                    disabled={isLoading}
                    onTranscript={(text) =>
                      setInput((current) => (current.trim() ? `${current} ${text}` : text))
                    }
                  />
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submitPrompt(input);
                      }
                    }}
                    rows={1}
                    placeholder="Ask about polarity, duty cycle, wire loading, porosity..."
                    className="min-h-12 flex-1 resize-none rounded-lg border border-black/[0.08] bg-white px-3 py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/65 focus:border-brass"
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopPrompt}
                      className="inline-flex h-12 items-center gap-2 rounded-lg border border-black/[0.08] bg-card-soft px-4 text-sm font-medium text-text-primary hover:bg-black/5"
                    >
                      <X size={17} />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#171A1F] px-4 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={17} />
                      Send
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </section>

        <div className="relative min-h-0 overflow-hidden">
          <button
            type="button"
            onPointerDown={startWorkspaceResize}
            className="group absolute left-0 top-0 z-30 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center xl:flex"
            aria-label="Resize visual workspace"
            title="Drag to resize visual workspace"
          >
            <span className="h-16 w-1 rounded-full border border-black/[0.08] bg-black/10 transition group-hover:h-24 group-hover:bg-brass" />
          </button>
          <VisualWorkspace
            response={displayedResponse}
            userQuestion={displayedUserQuestion}
            isLoading={isLoading && !pinnedTurnId && !streamingResponse}
          />
        </div>
      </div>
      <QuickSetupForm
        open={quickSetupOpen}
        onClose={() => setQuickSetupOpen(false)}
        onSubmit={handleQuickSetupSubmit}
      />
      <FaultCodeBrowser
        open={faultBrowserOpen}
        onClose={() => setFaultBrowserOpen(false)}
        onSelect={handleFaultSelect}
      />
    </main>
  );
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-black/[0.08] bg-card px-4 py-3 text-sm text-text-secondary shadow-panel">
      <span className="flex items-end gap-1" aria-hidden>
        <span className="h-2 w-2 animate-bounce rounded-full bg-brass" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-sage [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-ember [animation-delay:240ms]" />
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
