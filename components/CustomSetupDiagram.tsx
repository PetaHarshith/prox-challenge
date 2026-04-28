import type { WeldProcess } from "@/lib/manualKnowledge";
import { polaritySetups } from "@/lib/manualKnowledge";

type DiagramLine = {
  label: string;
  color: string;
  from: { x: number; y: number };
  to: "positive" | "negative" | "gas" | "foot";
  active?: boolean;
};

const socketPoints = {
  positive: { x: 462, y: 304 },
  negative: { x: 304, y: 304 },
  gas: { x: 624, y: 182 },
  foot: { x: 386, y: 214 }
};

function configFor(process: Exclude<WeldProcess, "unknown">) {
  if (process === "flux-core") {
    return {
      title: "Flux-core gasless setup",
      badge: "No gas required",
      warning: undefined,
      lines: [
        { label: "Ground clamp", color: "#4fb078", from: { x: 112, y: 118 }, to: "positive", active: true },
        { label: "Wire feed / MIG gun", color: "#394150", from: { x: 112, y: 310 }, to: "negative", active: true }
      ] satisfies DiagramLine[]
    };
  }

  if (process === "mig") {
    return {
      title: "MIG gas-shielded setup",
      badge: "Gas required",
      warning: undefined,
      lines: [
        { label: "Ground clamp", color: "#4fb078", from: { x: 112, y: 310 }, to: "negative", active: true },
        { label: "Wire feed / MIG gun", color: "#394150", from: { x: 112, y: 118 }, to: "positive", active: true },
        { label: "Gas line to regulator", color: "#8f9b94", from: { x: 624, y: 92 }, to: "gas", active: true }
      ] satisfies DiagramLine[]
    };
  }

  if (process === "tig") {
    return {
      title: "TIG setup",
      badge: "Gas + foot pedal",
      warning: "Do not connect wire feed cable during TIG",
      lines: [
        { label: "Ground clamp", color: "#4fb078", from: { x: 112, y: 118 }, to: "positive", active: true },
        { label: "TIG torch", color: "#9b7bd4", from: { x: 112, y: 310 }, to: "negative", active: true },
        { label: "Gas line to regulator", color: "#8f9b94", from: { x: 624, y: 92 }, to: "gas", active: true },
        { label: "Foot pedal", color: "#8f9b94", from: { x: 624, y: 338 }, to: "foot", active: true }
      ] satisfies DiagramLine[]
    };
  }

  return {
    title: "Stick setup",
    badge: "SMAW",
    warning: "Wire feed disconnected",
    lines: [
      { label: "Ground clamp", color: "#4fb078", from: { x: 112, y: 310 }, to: "negative", active: true },
        { label: "Electrode holder", color: "#B7F54A", from: { x: 112, y: 118 }, to: "positive", active: true }
    ] satisfies DiagramLine[]
  };
}

export function CustomSetupDiagram({ process }: { process: WeldProcess }) {
  if (process === "unknown") return null;
  const setup = polaritySetups[process];
  const config = configFor(process);
  const secondaryConnectorLabel = process === "tig" ? "Torch" : process === "stick" ? "Electrode holder" : "Wire feed";
  const secondaryPolarity = process === "stick" ? "+" : "−";

  return (
    <section className="rounded-xl border border-black/[0.08] bg-card p-5 shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{config.title}</h3>
          <p className="text-sm text-text-secondary">
            Positive: {setup.positive}. Negative: {setup.negative}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-brass/30 bg-brass px-3 py-1 text-xs font-semibold text-text-primary">{config.badge}</span>
          {config.warning ? <span className="rounded-full border border-brass/25 bg-brass/10 px-3 py-1 text-xs font-semibold text-brass">{config.warning}</span> : null}
        </div>
      </div>

      <svg viewBox="0 0 760 420" role="img" aria-label={`${config.title} wiring diagram`} className="h-auto w-full">
        <defs>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity="0.12" />
          </filter>
          <filter id="socketGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#B7F54A" floodOpacity="0.42" />
          </filter>
        </defs>

        <rect x="252" y="72" width="272" height="248" rx="18" fill="#17171c" filter="url(#softShadow)" />
        <rect x="284" y="104" width="208" height="72" rx="8" fill="#f5f0e6" />
        <text x="388" y="132" textAnchor="middle" fontSize="20" fontWeight="800" fill="#17171c">
          Vulcan
        </text>
        <text x="388" y="156" textAnchor="middle" fontSize="18" fontWeight="700" fill="#17171c">
          OmniPro 220
        </text>

        <circle
          cx={socketPoints.negative.x}
          cy={socketPoints.negative.y}
          r="33"
          fill="#f5f0e6"
          stroke={setup.negative.toLowerCase().includes("ground") || setup.negative.toLowerCase().includes("torch") ? "#B7F54A" : "#a4aaa3"}
          strokeWidth={setup.negative.toLowerCase().includes("ground") || setup.negative.toLowerCase().includes("torch") ? "6" : "4"}
          filter={setup.negative.toLowerCase().includes("ground") || setup.negative.toLowerCase().includes("torch") ? "url(#socketGlow)" : undefined}
        />
        <circle
          cx={socketPoints.positive.x}
          cy={socketPoints.positive.y}
          r="33"
          fill="#fff7e6"
          stroke={setup.positive.toLowerCase().includes("ground") || setup.positive.toLowerCase().includes("electrode") || setup.positive.toLowerCase().includes("wire") ? "#B7F54A" : "#D8F99B"}
          strokeWidth={setup.positive.toLowerCase().includes("ground") || setup.positive.toLowerCase().includes("electrode") || setup.positive.toLowerCase().includes("wire") ? "6" : "4"}
          filter={setup.positive.toLowerCase().includes("ground") || setup.positive.toLowerCase().includes("electrode") || setup.positive.toLowerCase().includes("wire") ? "url(#socketGlow)" : undefined}
        />
        <text x={socketPoints.negative.x} y="300" textAnchor="middle" fontSize="24" fontWeight="900" fill="#17171c">
          -
        </text>
        <text x={socketPoints.positive.x} y="300" textAnchor="middle" fontSize="24" fontWeight="900" fill="#a94d2d">
          +
        </text>
        <text x={socketPoints.negative.x} y="350" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8f9b94">
          Negative
        </text>
        <text x={socketPoints.positive.x} y="350" textAnchor="middle" fontSize="13" fontWeight="700" fill="#e67a4c">
          Positive
        </text>

        <rect x="572" y="142" width="104" height="80" rx="12" fill="#f5f0e6" stroke="#a4aaa3" opacity={config.lines.some((line) => line.to === "gas") ? 1 : 0.35} />
        <text x="624" y="174" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4f5652">
          Regulator
        </text>
        <text x="624" y="195" textAnchor="middle" fontSize="12" fill="#6c746f">
          gas
        </text>

        <rect x="570" y="300" width="108" height="56" rx="12" fill="#f5f0e6" stroke="#a4aaa3" opacity={config.lines.some((line) => line.to === "foot") ? 1 : 0.35} />
        <text x="624" y="333" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4f5652">
          Foot pedal
        </text>

        {config.lines.map((line) => {
          const target = socketPoints[line.to];
          return (
            <g key={`${line.label}-${line.to}`}>
              <path
                d={`M ${line.from.x + 92} ${line.from.y} C ${line.from.x + 190} ${line.from.y}, ${target.x - 120} ${target.y}, ${target.x} ${target.y}`}
                fill="none"
                stroke={line.color}
                strokeWidth={line.active ? "8" : "4"}
                strokeLinecap="round"
                opacity={line.active ? 1 : 0.25}
              />
              <circle cx={target.x} cy={target.y} r="6" fill={line.color} opacity={line.active ? 1 : 0.25} />
              <rect x={line.from.x - 68} y={line.from.y - 26} width="168" height="52" rx="12" fill="#f5f0e6" stroke={line.color} strokeWidth={line.active ? "3" : "2"} opacity={line.active ? 1 : 0.5} />
              <text x={line.from.x + 16} y={line.from.y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#17171c">
                {line.label}
              </text>
            </g>
          );
        })}

        {(process === "tig" || process === "stick") ? (
          <g>
            <line x1="112" y1="205" x2="245" y2="205" stroke="#e67a4c" strokeWidth="3" strokeDasharray="6 6" />
            <text x="114" y="194" textAnchor="start" fontSize="12" fontWeight="700" fill="#e67a4c">
              Wire feed: disconnected
            </text>
          </g>
        ) : null}
      </svg>

      <div className="mt-4 space-y-2 rounded-xl border border-black/[0.08] bg-card-soft p-3 text-xs font-medium text-text-secondary">
        <p><strong>Ground</strong> → {setup.positive.toLowerCase().includes("ground") ? "+" : "−"}</p>
        <p><strong>{secondaryConnectorLabel}</strong> → {secondaryPolarity}</p>
        {config.warning ? <p className="text-brass">{config.warning}</p> : null}
      </div>
    </section>
  );
}
