import Image from "next/image";
import type { ManualImage } from "@/lib/manualKnowledge";

export function ManualImageCard({ image }: { image: ManualImage }) {
  const isPdf = image.src.endsWith(".pdf");

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-600">Supporting reference</h4>
        <p className="mt-1 text-xs text-zinc-500">{image.title}</p>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        {isPdf ? (
          <div className="h-72 bg-zinc-100">
            <iframe src={image.src} title={image.title} className="h-full w-full border-0" />
          </div>
        ) : (
          <Image src={image.src} alt={image.title} width={1100} height={1500} className="h-auto w-full object-cover" />
        )}
      </div>

      {image.guide.secondaryNotes && image.guide.secondaryNotes.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-600">Reference notes</h4>
          <ul className="mt-2 space-y-1">
            {image.guide.secondaryNotes.map((note, idx) => (
              <li key={idx} className="text-xs leading-5 text-zinc-600">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
