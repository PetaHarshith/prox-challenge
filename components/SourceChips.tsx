import { ExternalLink } from "lucide-react";
import type { ManualRef } from "@/lib/manualKnowledge";

export function SourceChips({ refs }: { refs: ManualRef[] }) {
  if (!refs.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {refs.map((ref) => (
        <a
          key={`${ref.source}-${ref.title}`}
          href={ref.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
        >
          {ref.source}
          {ref.page ? ` p. ${ref.page}` : ""}
          <ExternalLink size={12} />
        </a>
      ))}
    </div>
  );
}
