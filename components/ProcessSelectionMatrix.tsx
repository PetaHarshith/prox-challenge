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
    <section className="overflow-hidden rounded-xl border border-black/[0.08] bg-card shadow-none">
      <div className="border-b border-black/[0.08] px-3 py-2.5">
        <h3 className="text-sm font-semibold text-text-primary">Process selection matrix</h3>
        <p className="mt-0.5 text-xs text-text-secondary">Choose by gas, environment, and finish.</p>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="min-w-[680px] border-separate border-spacing-0 text-left text-[11px] leading-4">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-text-secondary">
              <th className="py-1.5 pl-2 pr-2">Process</th>
              <th className="py-1.5 pr-2">Gas</th>
              <th className="py-1.5 pr-2">Best for</th>
              <th className="py-1.5 pr-2">Outdoor</th>
              <th className="py-1.5 pr-2">Finish</th>
              <th className="py-1.5 pr-2">Ease</th>
              <th className="py-1.5">Wiring</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const highlighted = highlightProcess === row.id;
              return (
                <tr key={row.id} className={`border-b border-black/[0.06] last:border-b-0 ${highlighted ? "bg-[#EEF8DC]" : ""}`}>
                  <td className={`py-2 pl-2 pr-2 font-semibold ${highlighted ? "border-l-2 border-brass text-[#3D5F0D]" : "border-l-2 border-transparent text-text-primary"}`}>{row.label}</td>
                  <td className="py-2 pr-2 text-text-secondary">{row.gasRequired}</td>
                  <td className="py-2 pr-2 text-text-secondary">{row.bestFor}</td>
                  <td className="py-2 pr-2 text-text-secondary">{row.worksOutdoors}</td>
                  <td className="py-2 pr-2 text-text-secondary">{row.cleanliness}</td>
                  <td className="py-2 pr-2 text-text-secondary">{row.beginnerFriendly}</td>
                  <td className="py-2 text-text-secondary">{row.setupNotes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
