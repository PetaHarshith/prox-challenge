export type TroubleshootingItem = { cause: string; check: string; fix: string };

// Maps a free-form question to the symptom name used as the start node of
// the flowchart. Keyword list mirrors the defect names in
// `weldDiagnosisKnowledge` so the start node always names a real KB entry
// instead of a generic "Weld defect".
function detectSymptom(question: string): string {
    const q = question.toLowerCase();
    if (/porosity|porous|pinhole/.test(q)) return "Porosity or pinholes";
    if (/spatter/.test(q)) return "Excessive spatter";
    if (/burn[- ]?through/.test(q)) return "Burn through";
    if (/wavy|inconsistent|uneven/.test(q)) return "Wavy or inconsistent bead";
    if (/bird.?nest|tangle/.test(q)) return "Bird nesting at feeder";
    return "Weld defect";
}

// Turns a KB cause string into a short checkpoint label phrased as an
// affirmative state ("Polarity correct", "Metal clean") so each diamond
// reads as a yes/no question. Keeps the No branch as the "this is the
// problem" path consistently across every item.
function topicLabel(cause: string): string {
    const c = cause.toLowerCase();
    if (/polarity/.test(c)) return "Polarity correct";
    if (/dirty|clean|oil|paint|rust|mill|moisture/.test(c)) return "Metal clean";
    if (/gas|cylinder|flow|draft|regulator/.test(c)) return "Gas flow OK";
    if (/wire|tip|nozzle|liner|contact/.test(c)) return "Wire and tip OK";
    if (/drive|tension|roller/.test(c)) return "Drive tension OK";
    if (/voltage|amperage|setting|too hot|too cold/.test(c)) return "Settings correct";
    if (/travel|stick.?out|angle|technique/.test(c)) return "Technique steady";
    if (/thickness|gap|fit/.test(c)) return "Joint fit OK";
    return shortLabel(cause, 4);
}

// Trims a KB fix sentence down to a short imperative for the No-branch box.
// Splits on the first comma or parenthesis so qualifiers like "(TIG/flux-core
// ground +, MIG/stick ground −)" don't leak into the diagram.
function fixLabel(fix: string): string {
    const head = fix.split(/[,(]/)[0].trim();
    return shortLabel(head, 5) || "Apply manual fix";
}

function shortLabel(text: string, max: number): string {
    const ascii = text.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    return ascii.split(" ").slice(0, max).join(" ");
}

// Builds a deterministic Yes/No troubleshooting flowchart from KB items:
// a symptom start node, then a chain of diamond checkpoints (one per cause).
// "No" branches off to the KB fix (red); "Yes" continues to the next check
// (green). Chain terminates in "Check technique and test on scrap".
//
// Edge declaration order is fixed so we can append `linkStyle` directives
// referencing edges by index without any source-walking regex.
export function buildTroubleshootingMermaid(
    items: TroubleshootingItem[] | undefined,
    question?: string
): string | undefined {
    const top = items?.slice(0, 3) ?? [];
    if (!top.length) return undefined;
    const symptom = detectSymptom(question ?? "");
    const lines: string[] = ["flowchart TD"];
    lines.push(`    S[${symptom}] --> Q0`);
    top.forEach((item, i) => {
        const topic = topicLabel(item.cause) || `Check ${i + 1}`;
        const fix = fixLabel(item.fix) || `Fix ${i + 1}`;
        const next = i < top.length - 1 ? `Q${i + 1}` : "Done";
        lines.push(`    Q${i}{${topic}} -->|Yes| ${next}`);
        lines.push(`    Q${i} -->|No| F${i}[${fix}]`);
    });
    lines.push("    Done[Check technique and test on scrap]");
    // Edge index layout (deterministic):
    //   0: S --> Q0
    //   then for each item i:
    //     1 + 2*i: Q{i} -->|Yes| next  (green)
    //     2 + 2*i: Q{i} -->|No|  F{i}  (red)
    const styles: string[] = [];
    top.forEach((_, i) => {
        styles.push(`    linkStyle ${1 + 2 * i} stroke:#16A34A,stroke-width:2px;`);
        styles.push(`    linkStyle ${2 + 2 * i} stroke:#DC2626,stroke-width:2px;`);
    });
    return [...lines, ...styles].join("\n");
}


