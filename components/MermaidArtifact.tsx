"use client";

import { useEffect, useState } from "react";
import { Workflow } from "lucide-react";

// Renders a Mermaid troubleshooting flowchart inline. Lazy-loads the mermaid
// bundle on first mount. Render failures collapse to null silently so a bad
// diagram never breaks the chat bubble.
export function MermaidArtifact({ content }: { content: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("mermaid");
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          suppressErrorRendering: true,
          fontFamily: "inherit",
          flowchart: {
            curve: "basis",
            padding: 14,
            nodeSpacing: 36,
            rankSpacing: 44,
            useMaxWidth: true,
            htmlLabels: true
          },
          themeVariables: {
            primaryColor: "#FFFFFF",
            primaryTextColor: "#171A1F",
            primaryBorderColor: "#171A1F",
            lineColor: "#6B6B6B",
            edgeLabelBackground: "#FFFFFF",
            fontSize: "13px"
          }
        });
        const id = `m${Math.random().toString(36).slice(2, 10)}`;
        const cleaned = content.trim().replace(/^```mermaid\s*/i, "").replace(/```\s*$/i, "");
        const { svg } = await mermaid.render(id, cleaned);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (failed || !svg) return null;

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-4 shadow-none">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Workflow size={15} className="text-text-secondary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Troubleshooting flow
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-[#16A34A]" aria-hidden />
            Yes — next check
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded bg-[#DC2626]" aria-hidden />
            No — apply fix
          </span>
        </div>
      </header>
      <div
        className="mermaid-artifact mx-auto flex justify-center overflow-x-auto py-1 [&_.edgeLabel]:bg-white [&_.edgeLabel]:px-1 [&_.edgeLabel]:text-[11px] [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </section>
  );
}
