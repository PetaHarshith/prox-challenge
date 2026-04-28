import { ExternalLink } from "lucide-react";
import type { ManualRef } from "@/lib/manualKnowledge";

export function SourceChips({ refs }: { refs: ManualRef[] }) {
  if (!refs.length) return null;

  // Dedupe by the chip's visible identity (source + page + url). Two refs with
  // different titles but the same source/page render identically, so we keep
  // the first occurrence and drop the rest.
  const seen = new Set<string>();
  const uniqueRefs = refs.filter((ref) => {
    const key = `${ref.source}|${ref.page ?? ""}|${ref.url ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="flex flex-wrap gap-2">
      {uniqueRefs.map((ref) => (
        <a
          key={`${ref.source}|${ref.page ?? ""}|${ref.url ?? ""}`}
          href={ref.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-card-soft px-2 py-1 text-xs font-medium text-text-secondary hover:bg-black/5 hover:text-text-primary"
        >
          {ref.source}
          {ref.page ? ` p. ${ref.page}` : ""}
          <ExternalLink size={12} />
        </a>
      ))}
    </div>
  );
}
