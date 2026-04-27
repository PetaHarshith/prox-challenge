"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { SourceChips } from "@/components/SourceChips";
import { MarkdownContent } from "@/components/MarkdownContent";
import { VisualWorkspace } from "@/components/VisualWorkspace";
import type { AgentResponse } from "@/lib/agentResponse";
import type { ConversationState } from "@/lib/conversationState";
import type { CachedResponseData } from "@/lib/prebuiltAnswers";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreview?: string;
  response?: CachedResponseData;
};

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const suggestionChips = [
  { label: "TIG setup", prompt: "I need to set up TIG. What cables go where?" },
  { label: "MIG duty cycle", prompt: "What's the duty cycle for MIG at 200A on 240V?" },
  { label: "Flux-core porosity", prompt: "I'm getting porosity in my flux-cored welds. What should I check?" },
  { label: "Load wire", prompt: "How do I load the wire spool?" },
  { label: "Choose process", prompt: "How do I choose between MIG, flux-core, TIG, and stick?" },
  { label: "MIG vs TIG", prompt: "What's the difference between MIG and TIG welding?" }
];

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
  const [conversationState, setConversationState] = useState<ConversationState>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRequestController = useRef<AbortController | null>(null);

  const apiMessages = useMemo(
    () =>
      turns
        .filter((turn) => turn.id !== "welcome")
        .map((turn) => ({ role: turn.role, content: turn.content }))
        .slice(-8),
    [turns]
  );

  const latestResponse = useMemo(
    () => [...turns].reverse().find((turn) => turn.role === "assistant" && turn.response)?.response,
    [turns]
  );

  async function submitPrompt(prompt: string) {
    if (!prompt.trim() || isLoading) return;

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      imagePreview
    };

    setTurns((current) => [...current, userTurn]);
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
    }
  }

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
    <main className="flex h-screen min-h-[720px] flex-col bg-[#f4f5f7] text-zinc-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-sm font-black text-white">
            220
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Vulcan OmniPro 220 Assistant</h1>
            <p className="truncate text-xs text-zinc-500">Conversational technical guidance and visual setup reference</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:flex">
          <ShieldCheck size={14} />
          Claude + manual retrieval
        </div>
      </header>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <section className="flex min-h-0 flex-col bg-[#f7f7f8]">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {turns.map((turn) => (
                <article key={turn.id} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      turn.role === "user"
                        ? "max-w-[82%] rounded-lg bg-zinc-950 px-4 py-3 text-white shadow-sm"
                        : "max-w-[88%] rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 shadow-sm"
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
                  </div>
                </article>
              ))}
              {isLoading ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Checking pre-indexed knowledge...
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-zinc-200 bg-white p-4">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-3 flex flex-wrap gap-2">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitPrompt(chip.prompt)}
                      className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
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
                    className="min-h-12 flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                  />
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={stopPrompt}
                      className="inline-flex h-12 items-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-700"
                    >
                      <X size={17} />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="inline-flex h-12 items-center gap-2 rounded-md bg-torch px-4 text-sm font-semibold text-white hover:bg-[#c94114] disabled:cursor-not-allowed disabled:opacity-50"
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

        <VisualWorkspace response={latestResponse} />
      </div>
    </main>
  );
}
