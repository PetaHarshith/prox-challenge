"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Eye, ImagePlus, Send, Wand2, X } from "lucide-react";
import { SourceChips } from "@/components/SourceChips";
import { MarkdownContent } from "@/components/MarkdownContent";
import { VisualWorkspace } from "@/components/VisualWorkspace";
import { QuickSetupForm } from "@/components/QuickSetupForm";
import type { AgentResponse, VisualSpec } from "@/lib/agentResponse";
import type { ConversationState } from "@/lib/conversationState";
import type { CachedResponseData } from "@/lib/prebuiltAnswers";
import { recommendFromAnswers, type QuickSetupAnswers } from "@/lib/quickSetup";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  response?: CachedResponseData;
};

// Returns true when the workspace would render at least one panel for this
// response. Mirrors the conditions inside VisualWorkspace's answer tab so the
// "View visual" affordance only appears on messages that produced a visual.
function hasWorkspaceVisuals(response?: CachedResponseData): boolean {
  if (!response) return false;
  if (response.visuals?.length) return true;
  if (response.visualType === "polarity") return true;
  if (response.visualType === "duty-cycle" && response.dutyCycleRows?.length) return true;
  if (response.visualType === "process-selection") return true;
  if (response.visualType === "image-diagnosis" && response.imageDiagnosis) return true;
  if (response.visualType === "troubleshooting" && (response.troubleshootingItems?.length || response.checklist?.length)) return true;
  if (response.settingRecommendation) return true;
  if (response.manualImages?.length) return true;
  return false;
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
  // Lightweight visual history: when the user clicks "View visual" on an older
  // assistant message, pin its turn id so the workspace shows that message's
  // saved visual payload. Cleared whenever a fresh assistant response arrives
  // so the latest answer always wins by default.
  const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRequestController = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function handleQuickSetupSubmit(answers: QuickSetupAnswers) {
    const { question, response } = buildQuickSetupResponse(answers);
    setTurns((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: crypto.randomUUID(), role: "assistant", content: response.answer, response }
    ]);
    setQuickSetupOpen(false);
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

  const displayedResponse = pinnedTurn?.response ?? latestResponse;

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

      const data = (await response.json()) as AgentResponse & { warning?: string; usedModel?: string; conversationState?: ConversationState; cacheHit?: boolean };

      // Cache the response if no image (image reasoning results shouldn't be cached)
      if (!image) {
        clientCache.set(cacheKey, data);
      }

      setConversationState(data.conversationState ?? {});
      setTurns((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          response: data
        }
      ]);
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
    <main className="flex h-screen min-h-[720px] flex-col bg-[radial-gradient(circle_at_top_left,#fff1e7_0,#f7fafc_34%,#e7edf1_100%)] text-slate-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-900/10 bg-[#18212b] px-5 text-white shadow-lg shadow-slate-900/10">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-torch text-sm font-black text-white shadow-md shadow-orange-950/30">
            220
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-white">Vulcan OmniPro 220 Assistant</h1>
            <p className="truncate text-xs text-slate-300">Garage setup, troubleshooting, and visual weld guidance</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <section className="flex min-h-0 flex-col bg-transparent">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {turns.map((turn) => {
                const turnHasVisuals = turn.role === "assistant" && hasWorkspaceVisuals(turn.response);
                const isPinned = pinnedTurnId === turn.id;
                const isLatestAssistant = turn.id === latestAssistantTurn?.id;
                return (
                  <article key={turn.id} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        turn.role === "user"
                          ? "max-w-[82%] rounded-lg bg-[#223142] px-4 py-3 text-white shadow-md shadow-slate-900/10"
                          : `max-w-[88%] rounded-lg border bg-white/95 px-4 py-3 text-slate-900 shadow-sm backdrop-blur ${isPinned ? "border-torch ring-1 ring-torch/30" : "border-slate-200"}`
                      }
                    >
                      {turn.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm leading-6">{turn.content}</p>
                      ) : (
                        <MarkdownContent content={turn.content} />
                      )}
                      {turn.imagePreview ? (
                        <Image src={turn.imagePreview} alt="Uploaded question context" width={360} height={240} className="mt-3 rounded-md border border-white/20" />
                      ) : null}
                      {turn.response?.highlights?.warning ? (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                          <span aria-hidden>⚠</span>
                          <span>{turn.response.highlights.warning}</span>
                        </div>
                      ) : null}
                      {turn.response?.refs?.length ? (
                        <div className="mt-3">
                          <SourceChips refs={turn.response.refs} />
                        </div>
                      ) : null}
                      {turn.response?.reasoning_summary ? (
                        <details className="mt-3 text-xs text-zinc-600">
                          <summary className="cursor-pointer select-none font-semibold text-zinc-700 hover:text-zinc-900">Why this answer</summary>
                          <p className="mt-1.5 leading-5">{turn.response.reasoning_summary}</p>
                        </details>
                      ) : null}
                      {turn.response?.warning ? <p className="mt-3 text-xs text-amber-700">{turn.response.warning}</p> : null}
                      {turnHasVisuals && !isLatestAssistant ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setPinnedTurnId(isPinned ? null : turn.id)}
                            aria-pressed={isPinned}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${isPinned ? "border-torch bg-orange-50 text-torch" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"}`}
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

          <form onSubmit={handleSubmit} className="border-t border-white/70 bg-white/70 p-4 shadow-[0_-18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-panel">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setQuickSetupOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-orange-500 bg-white px-3.5 py-1.5 text-xs font-black text-orange-700 shadow-sm shadow-orange-900/10 ring-2 ring-orange-100 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-torch text-white">
                      <Wand2 size={12} />
                    </span>
                    Quick Setup
                  </button>
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitPrompt(chip.prompt)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {imagePreview ? (
                  <div className="mb-3 flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2">
                    <Image src={imagePreview} alt="Upload preview" width={70} height={52} className="h-12 w-16 rounded object-cover" />
                    <span className="flex-1 text-sm text-zinc-700">Image attached</span>
                    <button type="button" onClick={() => setImagePreview(undefined)} className="rounded-md p-2 text-zinc-500 hover:bg-zinc-200" aria-label="Remove image">
                      <X size={16} />
                    </button>
                  </div>
                ) : null}

                {uploadError ? <p className="mb-3 text-sm text-amber-700">{uploadError}</p> : null}

                <div className="flex gap-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                    aria-label="Attach image"
                  >
                    <ImagePlus size={20} />
                  </button>
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
                    className="min-h-12 flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-torch focus:ring-2 focus:ring-orange-100"
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopPrompt}
                      className="inline-flex h-12 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                      <X size={17} />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="inline-flex h-12 items-center gap-2 rounded-md bg-torch px-4 text-sm font-semibold text-white shadow-sm shadow-orange-900/20 hover:bg-[#c94114] disabled:cursor-not-allowed disabled:opacity-50"
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

        <VisualWorkspace
          response={displayedResponse}
          userQuestion={displayedUserQuestion}
          isLoading={isLoading && !pinnedTurnId}
        />
      </div>
      <QuickSetupForm
        open={quickSetupOpen}
        onClose={() => setQuickSetupOpen(false)}
        onSubmit={handleQuickSetupSubmit}
      />
    </main>
  );
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-lg border border-orange-100 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <span className="flex items-end gap-1" aria-hidden>
        <span className="h-2 w-2 animate-bounce rounded-full bg-torch" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-orange-400 [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-amber-400 [animation-delay:240ms]" />
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
