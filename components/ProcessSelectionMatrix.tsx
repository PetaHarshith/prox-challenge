type ProcessRow = {
  id: "mig" | "flux-core" | "tig" | "stick";
  label: string;
  gasRequired: string;
  bestFor: string;
  worksOutdoors: string;
  cleanliness: string;
  beginnerFriendly: string;
  weldQuality: string;
  setupNotes: string;
};

const rows: ProcessRow[] = [
  {
    id: "mig",
    label: "MIG",
    gasRequired: "Yes",
    bestFor: "Clean indoor work",
    worksOutdoors: "Limited",
    cleanliness: "Low spatter",
    beginnerFriendly: "High",
    weldQuality: "Good",
    setupNotes: "Ground → −, Wire feed → +"
  },
  {
    id: "flux-core",
    label: "Flux-core",
    gasRequired: "No",
    bestFor: "Outdoor/no gas",
    worksOutdoors: "Yes",
    cleanliness: "More spatter",
    beginnerFriendly: "High",
    weldQuality: "Good with cleanup",
    setupNotes: "Ground → +, Wire feed → −"
  },
  {
    id: "tig",
    label: "TIG",
    gasRequired: "Yes",
    bestFor: "Precision/clean finish",
    worksOutdoors: "No",
    cleanliness: "Very clean",
    beginnerFriendly: "Low",
    weldQuality: "Highest control",
    setupNotes: "Ground → +, Torch → −"
  },
  {
    id: "stick",
    label: "Stick",
    gasRequired: "No",
    bestFor: "Rugged/thick/dirty",
    worksOutdoors: "Yes",
    cleanliness: "More slag/spatter",
    beginnerFriendly: "Medium",
    weldQuality: "Strong practical welds",
    setupNotes: "Ground → −, Electrode → +"
  }
];

export function ProcessSelectionMatrix({ highlightProcess }: { highlightProcess?: string }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-950">Process selection matrix</h3>
      <p className="mb-3 text-xs text-zinc-600">Why this matters: pick a process that matches gas availability, environment, and finish expectations.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">Process</th>
              <th className="py-2 pr-3">Gas</th>
              <th className="py-2 pr-3">Best for</th>
              <th className="py-2 pr-3">Outdoors</th>
              <th className="py-2 pr-3">Cleanliness</th>
              <th className="py-2 pr-3">Beginner</th>
              <th className="py-2 pr-3">Quality/control</th>
              <th className="py-2">Setup notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const highlighted = highlightProcess === row.id;
              return (
                <tr key={row.id} className={highlighted ? "bg-orange-50" : "bg-white"}>
                  <td className={`py-2 pr-3 font-semibold ${highlighted ? "text-orange-900" : "text-zinc-900"}`}>{row.label}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.gasRequired}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.bestFor}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.worksOutdoors}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.cleanliness}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.beginnerFriendly}</td>
                  <td className="py-2 pr-3 text-zinc-700">{row.weldQuality}</td>
                  <td className="py-2 text-zinc-700">{row.setupNotes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
