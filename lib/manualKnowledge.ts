export type VisualType = "polarity" | "duty-cycle" | "troubleshooting" | "manual-image" | "settings" | "process-selection" | "image-diagnosis" | "text";
export type WeldProcess = "mig" | "flux-core" | "tig" | "stick" | "unknown";

export type ManualRef = {
  title: string;
  source: "Owner's Manual" | "Quick Start Guide" | "Selection Chart";
  page?: string;
  url: string;
};

export type PolaritySetup = {
  process: Exclude<WeldProcess, "unknown">;
  label: string;
  positive: string;
  negative: string;
  gas?: string;
  wireFeed: "connected" | "disconnected";
  notes: string[];
  refs: ManualRef[];
};

export type DutyCycleRow = {
  input: "120V" | "240V";
  amperage: string;
  dutyCycle: string;
  weldMinutes: number;
  restMinutes: number;
};

export type ManualImage = {
  title: string;
  description: string;
  src: string;
  refs: ManualRef[];
  guide: ManualImageGuide;
};

export type ManualImageGuide = {
  heading: string;
  steps: string[];
  next: string;
  overlays: Array<{
    label: string;
    x: number;
    y: number;
    direction?: "top" | "bottom" | "left" | "right";
    w?: number;
    h?: number;
    importance?: "critical" | "secondary";
  }>;
  secondaryNotes?: string[];
};

export type SettingRecommendation = {
  process: Exclude<WeldProcess, "unknown">;
  material: string;
  thickness: string;
  inputVoltage: "120V" | "240V";
  summary: string;
  steps: string[];
  caution?: string;
  exactMatch?: boolean;
  missingInfo?: string[];
};

export const manualRefs = {
  owner: "/manuals/owner-manual.pdf",
  quickStart: "/manuals/quick-start-guide.pdf",
  selection: "/manuals/selection-chart.pdf"
};

export const ownerRef = (title: string, page?: string): ManualRef => ({
  title,
  source: "Owner's Manual",
  page,
  url: page ? `${manualRefs.owner}#page=${page}` : manualRefs.owner
});

export const quickRef = (title: string, page?: string): ManualRef => ({
  title,
  source: "Quick Start Guide",
  page,
  url: page ? `${manualRefs.quickStart}#page=${page}` : manualRefs.quickStart
});

export const selectionRef = (title: string): ManualRef => ({
  title,
  source: "Selection Chart",
  url: manualRefs.selection
});

export const polaritySetups: Record<Exclude<WeldProcess, "unknown">, PolaritySetup> = {
  mig: {
    process: "mig",
    label: "Solid-core MIG, gas-shielded",
    positive: "Wire feed power cable",
    negative: "Ground clamp / work lead",
    gas: "Connect shielding gas to regulator and welder inlet.",
    wireFeed: "connected",
    notes: [
      "Use DCEP for solid MIG wire: electrode positive, work clamp negative.",
      "Install the correct drive roller groove and contact tip for the wire diameter.",
      "Set shielding gas flow before welding, then verify wire feed direction and tension."
    ],
    refs: [quickRef("MIG setup polarity", "1"), ownerRef("MIG welding setup", "14")]
  },
  "flux-core": {
    process: "flux-core",
    label: "Flux-core, gasless",
    positive: "Ground clamp / work lead",
    negative: "Wire feed power cable",
    wireFeed: "connected",
    notes: [
      "Use DCEN for self-shielded flux-core wire: electrode negative, work clamp positive.",
      "Do not connect shielding gas for gasless flux-core wire.",
      "Check wire tension and keep the gun cable as straight as practical to prevent feeding problems."
    ],
    refs: [quickRef("Flux-core setup polarity", "1"), ownerRef("Flux-cored welding setup", "13")]
  },
  tig: {
    process: "tig",
    label: "TIG",
    positive: "Ground clamp / work lead",
    negative: "TIG torch",
    gas: "TIG torch gas line connects to the regulator/cylinder.",
    wireFeed: "disconnected",
    notes: [
      "Use DCEN for TIG: torch negative, work clamp positive.",
      "Plug the foot pedal into the connector inside the welder.",
      "Disconnect the wire feed power cable while TIG welding."
    ],
    refs: [ownerRef("TIG setup polarity", "24")]
  },
  stick: {
    process: "stick",
    label: "Stick / SMAW",
    positive: "Electrode holder",
    negative: "Ground clamp / work lead",
    wireFeed: "disconnected",
    notes: [
      "Typical stick setup is electrode holder positive and work clamp negative.",
      "Disconnect the wire feed power cable while stick welding.",
      "Confirm electrode packaging if a rod requires a different polarity."
    ],
    refs: [ownerRef("Stick setup polarity", "27")]
  }
};

export const dutyCycleRows: DutyCycleRow[] = [
  { input: "120V", amperage: "100A", dutyCycle: "40%", weldMinutes: 4, restMinutes: 6 },
  { input: "120V", amperage: "75A", dutyCycle: "100%", weldMinutes: 10, restMinutes: 0 },
  { input: "240V", amperage: "200A", dutyCycle: "25%", weldMinutes: 2.5, restMinutes: 7.5 },
  { input: "240V", amperage: "115A", dutyCycle: "100%", weldMinutes: 10, restMinutes: 0 }
];

export const manualImages: ManualImage[] = [
  {
    title: "Front panel controls",
    description: "Manual page showing the negative socket, positive socket, wire feed power cable, LCD, and controls.",
    src: "/manual-images/owner-p8.png",
    refs: [ownerRef("Front panel controls", "8")],
    guide: {
      heading: "Find the front-panel connection points",
      steps: ["Use the lower panel for work leads.", "Positive is on the right.", "Negative is left of positive."],
      next: "Match the sockets to the setup diagram before powering on.",
      overlays: [
        { label: "−", x: 39, y: 69, w: 14, h: 8, direction: "top", importance: "critical" },
        { label: "Wire feed cable", x: 56, y: 70, w: 10, h: 8, direction: "top", importance: "secondary" },
        { label: "+", x: 70, y: 66, w: 14, h: 9, direction: "top", importance: "critical" }
      ],
      secondaryNotes: ["Wire feed cable connects to setup diagram."]
    }
  },
  {
    title: "Wire spool quick start",
    description: "Quick-start visual for spool loading, feed guides, cold wire feed, and tension adjustment.",
    src: "/manual-images/quick-p1.png",
    refs: [quickRef("Wire spool loading", "1"), ownerRef("Wire feed tension", "17")],
    guide: {
      heading: "Here’s how to load the wire",
      steps: ["Install the spool so wire feeds toward the guides.", "Run wire through both feed guides.", "Tighten tension until wire bends against wood 2-3 inches away."],
      next: "Test cold wire feed before welding, then reinstall the contact tip and nozzle.",
      overlays: [
        { label: "Spool feeds →", x: 73, y: 24, w: 18, h: 14, direction: "left", importance: "critical" },
        { label: "Feed guides", x: 89, y: 17, w: 9, h: 9, direction: "left", importance: "critical" },
        { label: "Adjust tension", x: 28, y: 54, w: 15, h: 13, direction: "right", importance: "critical" }
      ],
      secondaryNotes: ["Wire should bend 2-3 inches away from tension point."]
    }
  },
  {
    title: "Process selection chart",
    description: "Manual chart for choosing process, wire/electrode, and setup by material and thickness.",
    src: "/manual-images/selection-p1.png",
    refs: [selectionRef("Welding process selection chart")],
    guide: {
      heading: "Choose the process first",
      steps: ["Use MIG for clean indoor work with gas.", "Use flux-core outdoors or without gas.", "Use stick for thicker/rougher work, TIG for precise clean welds."],
      next: "After choosing the process, use the setup diagram for cable polarity.",
      overlays: [
        { label: "Flux-core: no gas", x: 19, y: 62, w: 14, h: 10, direction: "top", importance: "critical" },
        { label: "MIG: gas shielded", x: 39, y: 62, w: 14, h: 10, direction: "top", importance: "critical" },
        { label: "Stick: outdoor", x: 61, y: 62, w: 14, h: 10, direction: "top", importance: "critical" },
        { label: "TIG: precision", x: 80, y: 62, w: 14, h: 10, direction: "top", importance: "critical" }
      ]
    }
  },
  {
    title: "Flux-core polarity setup",
    description: "Manual diagram for gasless flux-core DCEN wiring.",
    src: "/manual-images/owner-p13.png",
    refs: [ownerRef("Flux-cored welding setup", "13")],
    guide: {
      heading: "Flux-core cable setup",
      steps: ["Ground clamp goes to positive.", "Wire feed power cable goes to negative.", "Do not hook up shielding gas."],
      next: "Run a quick feed test, then make a small test weld on scrap.",
      overlays: [
        { label: "Ground → +", x: 73, y: 79, w: 15, h: 9, direction: "top", importance: "critical" },
        { label: "Wire → −", x: 56, y: 73, w: 15, h: 9, direction: "top", importance: "critical" }
      ],
      secondaryNotes: ["No shielding gas is required for flux-core."]
    }
  },
  {
    title: "Solid-core MIG polarity setup",
    description: "Manual diagram for gas-shielded solid-core MIG DCEP wiring and shielding gas setup.",
    src: "/manual-images/owner-p14.png",
    refs: [ownerRef("MIG welding setup", "14")],
    guide: {
      heading: "MIG cable and gas setup",
      steps: ["Ground clamp goes to negative.", "Wire feed power cable goes to positive.", "Gas hose connects from regulator to the welder inlet."],
      next: "Set gas flow, then test wire feed before striking an arc.",
      overlays: [
        { label: "Ground → −", x: 58, y: 23, w: 15, h: 9, direction: "bottom", importance: "critical" },
        { label: "Wire → +", x: 75, y: 28, w: 15, h: 9, direction: "bottom", importance: "critical" }
      ],
      secondaryNotes: ["Gas regulator and line connect to the welder inlet."]
    }
  },
  {
    title: "TIG setup",
    description: "Manual diagram for TIG torch, work clamp, foot pedal, and gas line setup.",
    src: "/manual-images/owner-p24.png",
    refs: [ownerRef("TIG setup", "24")],
    guide: {
      heading: "TIG hookup",
      steps: ["Ground clamp goes to positive.", "TIG torch goes to negative.", "Gas line goes to the regulator and foot pedal plugs inside the welder."],
      next: "Leave the wire feed disconnected, then set amperage before welding.",
      overlays: [
        { label: "Ground → +", x: 32, y: 32, w: 17, h: 10, direction: "right", importance: "critical" },
        { label: "Torch → −", x: 57, y: 26, w: 18, h: 10, direction: "bottom", importance: "critical" }
      ],
      secondaryNotes: ["Foot pedal plugs into the socket inside the machine.", "Gas line connects to the regulator and torch inlet."]
    }
  },
  {
    title: "Stick setup",
    description: "Manual diagram for electrode holder and work clamp setup.",
    src: "/manual-images/owner-p27.png",
    refs: [ownerRef("Stick setup", "27")],
    guide: {
      heading: "Stick cable setup",
      steps: ["Ground clamp goes to negative.", "Electrode holder goes to positive.", "No gas line or wire feed is used."],
      next: "Clamp to clean metal, then set amperage for the rod size.",
      overlays: [
        { label: "Electrode → +", x: 70, y: 13, w: 18, h: 9, direction: "bottom", importance: "critical" },
        { label: "Ground → −", x: 39, y: 13, w: 18, h: 9, direction: "bottom", importance: "critical" }
      ],
      secondaryNotes: ["No wire feed or shielding gas is used for stick welding."]
    }
  },
  {
    title: "Wire weld diagnosis",
    description: "Manual weld diagnosis page for porosity, excessive spatter, wavy bead, and burn-through.",
    src: "/manual-images/owner-p37.png",
    refs: [ownerRef("Wire weld troubleshooting", "37")],
    guide: {
      heading: "What porosity usually means",
      steps: ["Check polarity first.", "Clean the workpiece and wire.", "For MIG, check gas flow, nozzle, and drafts."],
      next: "Make one small test bead after each fix so you can see what changed.",
      overlays: [
        { label: "Porosity: holes", x: 20, y: 10, w: 23, h: 11, direction: "bottom", importance: "critical" },
        { label: "Check polarity", x: 9, y: 20, w: 30, h: 10, direction: "right", importance: "critical" }
      ],
      secondaryNotes: ["Excessive spatter can indicate polarity or speed issues.", "Burn-through usually means the settings are too hot for the material thickness."]
    }
  }
];

export const processManualImageIndex: Record<Exclude<WeldProcess, "unknown">, number> = {
  "flux-core": 3,
  mig: 4,
  tig: 5,
  stick: 6
};

export const troubleshootingChecks: Record<string, string[]> = {
  porosity: [
    "Confirm the selected process matches the wire: gasless flux-core should not use shielding gas; solid MIG wire needs shielding gas.",
    "For flux-core, verify polarity is DCEN: wire feed cable negative and ground clamp positive.",
    "Clean oil, paint, rust, mill scale, and moisture from the joint area.",
    "If using gas-shielded MIG, check cylinder valve, regulator flow, gas hose, and drafts at the weld.",
    "Trim contaminated wire and confirm the contact tip and nozzle are clean.",
    "Reduce stick-out and keep a steady travel angle so the puddle stays protected."
  ],
  wire: [
    "Make sure the spool unwinds toward the inlet guide without crossing over itself.",
    "Match the drive roller groove and contact tip to the wire diameter.",
    "Set enough tension to feed consistently without crushing the wire.",
    "Keep the gun lead straight while loading wire.",
    "Clip the wire cleanly before feeding it through the liner."
  ],
  badWeld: [
    "Check polarity first for the selected process.",
    "Verify material thickness and choose settings from the setup chart.",
    "Clean the work clamp contact point and clamp directly to the workpiece when possible.",
    "Inspect consumables: contact tip, nozzle, electrode, and ground lead.",
    "Make one adjustment at a time: voltage/arc length, wire speed/amperage, then travel speed."
  ]
};

export function detectProcess(input: string): WeldProcess {
  const text = input.toLowerCase();
  if (/\bflux|fcaw|gasless|self[- ]shield/.test(text)) return "flux-core";
  if (/\btig|gtaw|torch|tungsten|foot pedal/.test(text)) return "tig";
  if (/\bstick|smaw|electrode holder|rod\b/.test(text)) return "stick";
  if (/\bmig|gmaw|solid[- ]core|shielding gas|wire feed/.test(text)) return "mig";
  return "unknown";
}

export function extractMaterial(input: string): string | undefined {
  const text = input.toLowerCase();
  if (/mild steel|carbon steel/.test(text)) return "mild steel";
  if (/stainless/.test(text)) return "stainless steel";
  if (/aluminum|aluminium/.test(text)) return "aluminum";
  if (/\bsteel\b/.test(text)) return "mild steel";
  return undefined;
}

export function extractThickness(input: string): string | undefined {
  const normalized = input
    .toLowerCase()
    .replace(/\bone[\s-]?eighth\b/g, "1/8")
    .replace(/\bthree[\s-]?sixteenths?\b/g, "3/16")
    .replace(/\bone[\s-]?quarter\b/g, "1/4")
    .replace(/\bone[\s-]?half\b/g, "1/2");

  const gaugeMatch = normalized.match(/\b(\d{1,2})\s*(gauge|ga)\b/);
  if (gaugeMatch) return `${gaugeMatch[1]} gauge`;

  const fractionInchMatch = normalized.match(/\b(\d+\s*\/\s*\d+)\s*(in|inch|inches|\")?\b/);
  if (fractionInchMatch) return `${fractionInchMatch[1].replace(/\s+/g, "")} inch`;

  const decimalInchMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(in|inch|inches|\")\b/);
  if (decimalInchMatch) return `${decimalInchMatch[1]} inch`;

  const mmMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*mm\b/);
  if (mmMatch) return `${mmMatch[1]} mm`;

  return undefined;
}

export function classifyQuestion(input: string): VisualType {
  const text = input.toLowerCase();
  if (/\bduty cycle\b|\bweld continuously\b|overheat|thermal shutdown|\bweld time\b|\brest time\b|how long can i weld/.test(text)) return "duty-cycle";
  // Setup/polarity must be checked BEFORE process-selection so a question that
  // mentions a process noun (TIG/MIG/flux/stick) but is really asking about
  // wiring routes here, not to the comparison matrix.
  if (
    /\bpolarity\b|\bsetup\b|\bset\s*up\b|\bset\s*it\s*up\b|\bdcen\b|\bdcep\b|\bwhich cable\b|\bcable goes where\b|\b(positive|negative|\+|−)\s*(socket|terminal)\b/.test(text)
    || (/\b(torch|tig torch|electrode holder|ground clamp|work lead|wire feed cable|wire feed power|foot pedal)\b/.test(text)
      && /\b(where|which|how|what|connect|cable|socket|plug|hook|goes)\b/.test(text))
    || /\bwhere (do|does|should) (i|it|they) (connect|plug|go|hook)\b/.test(text)
    || /\bhow (do i|to) (connect|hook|plug|wire|set)\b/.test(text)
  ) {
    return "polarity";
  }
  if (/\bchoose between\b|\bwhich process\b|\bwhat process\b|\bcompare\b|\bbest process\b|\bshould i use\b|\bdifference between\b|\b(mig|tig|flux(?:-?core)?|stick)\s*(vs\.?|versus)\s*(mig|tig|flux(?:-?core)?|stick)\b|don'?t have gas|\bno gas\b/.test(text)) return "process-selection";
  if (/\bload(ing)?\b.*\b(wire|spool)\b|\bwire spool\b|feed guides|drive roller|\bwire tension\b/.test(text)) return "manual-image";
  if (/troubleshoot|porosity|spatter|bird.?nest|bad weld|not feeding|burn[- ]through|defect|unstable arc/.test(text)) {
    return "troubleshooting";
  }
  if (/\bsettings?\b|\brecommend\b|wire speed|\bvoltage setting\b|\bthickness\b|\bmaterial\b|1\/8|one eighth|mild steel|selection chart|\b\d+\s*(mm|gauge|ga)\b/.test(text)) {
    return "settings";
  }
  return "text";
}

export function retrieveManualContext(input: string) {
  const process = detectProcess(input);
  const visualType = classifyQuestion(input);
  const refs = new Map<string, ManualRef>();
  const snippets: string[] = [];

  if (process !== "unknown") {
    const setup = polaritySetups[process];
    snippets.push(`${setup.label}: positive socket = ${setup.positive}; negative socket = ${setup.negative}; wire feed ${setup.wireFeed}.`);
    setup.notes.forEach((note) => snippets.push(note));
    setup.refs.forEach((ref) => refs.set(`${ref.source}-${ref.title}`, ref));
  }

  if (/gas line|regulator|shielding gas/.test(input.toLowerCase())) {
    if (process === "stick") snippets.push("Stick welding does not use a shielding gas line; connect ground clamp negative and electrode holder positive.");
    if (process === "flux-core") snippets.push("Gasless flux-core does not use shielding gas; connect ground clamp positive and wire feed power cable negative.");
    if (process === "tig") snippets.push("TIG uses shielding gas: connect the TIG torch gas line to the regulator/cylinder.");
    if (process === "mig") snippets.push("Gas-shielded MIG uses shielding gas: connect gas to the regulator and welder inlet.");
  }

  if (visualType === "duty-cycle") {
    snippets.push("Duty cycle is measured in a 10-minute window. 40% means 4 minutes welding and 6 minutes resting.");
    snippets.push("MIG duty cycle: 120V is 40% at 100A and 100% at 75A; 240V is 25% at 200A and 100% at 115A.");
    refs.set("owner-duty-cycle", ownerRef("MIG duty cycle ratings", "7"));
  }

  if (visualType === "troubleshooting") {
    const checks = /porosity|hole|pin/.test(input.toLowerCase())
      ? troubleshootingChecks.porosity
      : /feed|bird/.test(input.toLowerCase())
        ? troubleshootingChecks.wire
        : troubleshootingChecks.badWeld;
    checks.forEach((check) => snippets.push(check));
    refs.set("owner-troubleshooting", ownerRef("Troubleshooting and weld diagnosis", "37"));
  }

  if (/spool|inside|panel|wire|roller|tension|load/.test(input.toLowerCase())) {
    snippets.push("The wire feed compartment image is relevant for spool loading, drive roller selection, wire tension, and the wire feed power cable.");
    refs.set("owner-wire-feed", quickRef("Wire spool loading", "1"));
    refs.set("owner-wire-tension", ownerRef("Wire feed tension", "17"));
  }

  if (/1\/8|1-8|one eighth|mild steel|selection|process should/.test(input.toLowerCase())) {
    snippets.push("For mild steel, process choice depends on thickness, power, finish, and whether shielding gas is available. Solid MIG is cleaner with gas; flux-core is practical outdoors; stick is useful for thicker material and outdoor work; TIG is slower and cleaner for precision.");
    refs.set("selection-chart", selectionRef("Welding process selection chart"));
  }

  if (snippets.length === 0) {
    snippets.push("Answer only from known Vulcan OmniPro 220 manual facts. If a requested value is not in the provided context, say what is known and ask a clarifying question.");
    refs.set("owner-general", ownerRef("Owner's manual"));
  }

  return {
    process,
    visualType,
    snippets,
    refs: Array.from(refs.values())
  };
}

export function recommendSettings({
  process,
  material,
  thickness,
  inputVoltage
}: {
  process: Exclude<WeldProcess, "unknown">;
  material: string;
  thickness: string;
  inputVoltage: "120V" | "240V";
}): SettingRecommendation {
  const setup = polaritySetups[process];
  const baseSteps = [
    `Wire polarity: positive socket = ${setup.positive}; negative socket = ${setup.negative}.`,
    "Use the LCD setup flow: select process, wire/electrode diameter, and material thickness.",
    "Use the machine's auto weld setting as the starting point; if you adjust manually, the LCD white mark shows the recommended line for that setup."
  ];

  if (process === "mig") {
    return {
      process,
      material,
      thickness,
      inputVoltage,
      summary: `Solid-core MIG is the cleanest default for ${thickness} ${material} when you have shielding gas and clean indoor conditions.`,
      exactMatch: false,
      missingInfo: ["wire diameter", "wire type", "target bead profile"],
      steps: [
        ...baseSteps,
        "Use shielding gas; the manual setup screen calls for gas setup and 20-30 SCFH.",
        "For mild steel, C25 is a common machine-screen gas option shown in the manual's MIG steel example.",
        inputVoltage === "120V" ? "Stay within the 120V output range for thinner material." : "Use 240V when you need the upper output range or more duty-cycle headroom."
      ],
      caution: "Do not invent wire speed/voltage from memory; confirm the displayed auto setting against the selection chart and the inside-door settings chart."
    };
  }

  if (process === "flux-core") {
    return {
      process,
      material,
      thickness,
      inputVoltage,
      summary: `Flux-core is practical for ${thickness} ${material} when you are outdoors, do not have shielding gas, or need more tolerance for less-than-perfect conditions.`,
      exactMatch: false,
      missingInfo: ["wire diameter", "joint type"],
      steps: [
        ...baseSteps,
        "Use self-shielded flux-core wire only; no shielding gas is required.",
        "Expect more spatter and slag cleanup than gas-shielded MIG.",
        "After welding, chip and brush slag so you can inspect the bead."
      ]
    };
  }

  if (process === "tig") {
    return {
      process,
      material,
      thickness,
      inputVoltage,
      summary: `TIG is the precision choice for ${thickness} ${material}, but it is slower and requires a separate TIG torch, gas, filler rod, and foot pedal setup.`,
      exactMatch: false,
      missingInfo: ["tungsten diameter", "filler rod size"],
      steps: [
        ...baseSteps,
        "Connect the TIG torch gas line to the regulator.",
        "Plug the foot pedal into the socket inside the welder.",
        "Consult the settings chart for tungsten size and set amperage conservatively before test welding."
      ]
    };
  }

  return {
    process,
    material,
    thickness,
    inputVoltage,
    summary: `Stick is useful for ${thickness} ${material} when outdoor work, dirty material, or thicker sections matter more than bead appearance.`,
    exactMatch: false,
    missingInfo: ["electrode class", "rod diameter"],
    steps: [
      ...baseSteps,
      "Pick the electrode type and diameter from the electrode packaging and selection chart.",
      "Confirm electrode packaging if it calls for a different polarity than the default setup.",
      inputVoltage === "240V" ? "240V gives access to the welder's upper stick output range." : "120V limits the usable stick output range."
    ]
  };
}

// Direct retrieval functions for fast, grounded responses

export type SetupAnswerTopic = "torch" | "ground" | "wire feed" | "electrode" | "gas" | "foot pedal";

// Validated, hardcoded setup recipes — never ask Claude to derive these.
const setupRecipes: Record<Exclude<WeldProcess, "unknown">, {
  headline: string;
  steps: string[];
  commonMistake: string;
  next: string;
  page: string;
}> = {
  tig: {
    headline: "Connect the **TIG torch to the negative (−) socket** and the **ground clamp to the positive (+) socket**.",
    steps: [
      "Turn off and unplug the welder.",
      "Plug the **ground clamp into positive (+)**.",
      "Plug the **TIG torch into negative (−)**.",
      "Leave the **wire feed power cable disconnected**.",
      "Connect the **gas line** from the cylinder through the regulator to the TIG torch.",
      "Plug the **foot pedal** into the foot pedal socket inside the welder."
    ],
    commonMistake: "Do not leave the wire feed power cable connected during TIG setup.",
    next: "Select TIG mode on the front panel, set amperage, and test on scrap.",
    page: "24"
  },
  "flux-core": {
    headline: "Connect the **ground clamp to positive (+)** and the **wire feed power cable to negative (−)**. No shielding gas.",
    steps: [
      "Turn off and unplug the welder.",
      "Plug the **ground clamp into positive (+)**.",
      "Plug the **wire feed power cable into negative (−)**.",
      "Leave the gas inlet disconnected — flux-core is self-shielded.",
      "Cold-feed the wire to confirm smooth feeding before welding."
    ],
    commonMistake: "Do not connect shielding gas — flux-core wire is self-shielded.",
    next: "Select flux-core on the front panel and set wire speed/voltage for your material.",
    page: "13"
  },
  mig: {
    headline: "Connect the **ground clamp to negative (−)** and the **wire feed power cable to positive (+)**. Shielding gas required.",
    steps: [
      "Turn off and unplug the welder.",
      "Plug the **ground clamp into negative (−)**.",
      "Plug the **wire feed power cable into positive (+)**.",
      "Connect shielding gas to the regulator and welder inlet.",
      "Cold-feed the wire to confirm smooth feeding before welding."
    ],
    commonMistake: "Do not run solid MIG wire without shielding gas — the bead will be porous.",
    next: "Select MIG on the front panel and set wire speed/voltage for your material thickness.",
    page: "14"
  },
  stick: {
    headline: "Connect the **electrode holder to positive (+)** and the **ground clamp to negative (−)**. Wire feed disconnected.",
    steps: [
      "Turn off and unplug the welder.",
      "Plug the **electrode holder into positive (+)**.",
      "Plug the **ground clamp into negative (−)**.",
      "Leave the wire feed power cable disconnected — no wire feed for stick.",
      "Clamp the ground lead directly to clean bare metal."
    ],
    commonMistake: "Confirm the rod packaging — some electrode classes require reverse polarity.",
    next: "Select stick on the front panel and set amperage for your electrode rod size.",
    page: "27"
  }
};

function topicHeadline(process: Exclude<WeldProcess, "unknown">, topic?: SetupAnswerTopic): string | undefined {
  if (!topic) return undefined;
  if (process === "tig") {
    if (topic === "torch") return "Connect the **TIG torch to the negative (−) socket**.";
    if (topic === "ground") return "Connect the **ground clamp to the positive (+) socket**.";
    if (topic === "wire feed") return "Leave the **wire feed power cable disconnected** during TIG.";
    if (topic === "gas") return "Connect the **gas line from the cylinder through the regulator** to the TIG torch.";
    if (topic === "foot pedal") return "Plug the **foot pedal into the foot pedal socket inside the welder**.";
  }
  if (process === "flux-core") {
    if (topic === "ground") return "Connect the **ground clamp to the positive (+) socket** for flux-core.";
    if (topic === "wire feed") return "Connect the **wire feed power cable to the negative (−) socket** for flux-core.";
    if (topic === "gas") return "Flux-core is self-shielded — leave the gas inlet disconnected.";
  }
  if (process === "mig") {
    if (topic === "ground") return "Connect the **ground clamp to the negative (−) socket** for MIG.";
    if (topic === "wire feed") return "Connect the **wire feed power cable to the positive (+) socket** for MIG.";
    if (topic === "gas") return "Connect shielding gas to the regulator and welder inlet for solid MIG wire.";
  }
  if (process === "stick") {
    if (topic === "electrode") return "Connect the **electrode holder to the positive (+) socket** for stick.";
    if (topic === "ground") return "Connect the **ground clamp to the negative (−) socket** for stick.";
    if (topic === "wire feed") return "Leave the **wire feed power cable disconnected** for stick.";
  }
  return undefined;
}

export function getDirectPolarityAnswer(process: Exclude<WeldProcess, "unknown">, topic?: SetupAnswerTopic) {
  const setup = polaritySetups[process];
  const recipe = setupRecipes[process];
  const direct = topicHeadline(process, topic) ?? recipe.headline;
  const stepsBlock = recipe.steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
  const answer = `${direct}\n\n**Steps:**\n${stepsBlock}\n\n**Common mistake:** ${recipe.commonMistake}\n\n**Next:** ${recipe.next}`;
  return {
    visualType: "polarity" as const,
    process,
    answer,
    checklist: setup.notes,
    refs: setup.refs,
    manualImages: [manualImages[processManualImageIndex[process]]],
    highlightContext: {
      type: "polarity" as const,
      emphasis: `${setup.positive} → +, ${setup.negative} → −`
    }
  };
}

export function getDutyCycleAnswerForAmperage(amperage: number, voltage: "120V" | "240V") {
  const rows = dutyCycleRows.filter((row) => row.input === voltage);
  const match = rows.reduce((best, row) => {
    const rowAmps = Number(row.amperage.replace("A", ""));
    const bestAmps = Number(best.amperage.replace("A", ""));
    return Math.abs(rowAmps - amperage) < Math.abs(bestAmps - amperage) ? row : best;
  }, rows[0]);

  if (!match) {
    return null;
  }

  return {
    visualType: "duty-cycle" as const,
    answer: `At ${match.amperage} on ${voltage}, you can weld for ${match.weldMinutes} minutes, then let it cool for ${match.restMinutes} minutes.`,
    dutyCycleRows: dutyCycleRows,
    refs: [ownerRef("Duty cycle ratings", "7")],
    highlightContext: {
      type: "duty-cycle" as const,
      highlightKey: `${match.input}-${match.amperage}`,
      highlightLabel: `${match.weldMinutes} min weld / ${match.restMinutes} min rest`
    }
  };
}

export function getTroubleshootingAnswerForIssue(issue: "porosity" | "wire" | "badWeld") {
  const checks = troubleshootingChecks[issue] || troubleshootingChecks.badWeld;
  const issueLabel =
    issue === "porosity" ? "porosity (small holes in the bead)"
      : issue === "wire" ? "wire feed or bird-nesting issues"
        : "bad weld appearance";

  return {
    visualType: "troubleshooting" as const,
    answer: `For ${issueLabel}, start by checking polarity and wire/shielding conditions. Then work through these steps one at a time so you know what fixed it.`,
    checklist: checks,
    refs: [ownerRef("Troubleshooting and weld diagnosis", "37")]
  };
}

export type DirectResponse = {
  visualType: VisualType;
  process?: WeldProcess;
  answer: string;
  checklist?: string[];
  dutyCycleRows?: DutyCycleRow[];
  refs: ManualRef[];
  manualImages?: ManualImage[];
  settingRecommendation?: SettingRecommendation;
  recommendedProcess?: "mig" | "flux-core" | "tig" | "stick";
  highlightContext?: {
    type?: "duty-cycle" | "polarity" | "troubleshooting";
    highlightKey?: string;
    highlightLabel?: string;
    emphasis?: string;
  };
};

function extractSetupTopic(lower: string): SetupAnswerTopic | undefined {
  if (/\btig torch\b|\btorch\b/.test(lower)) return "torch";
  if (/\belectrode holder\b|\belectrode\b|\brod\b/.test(lower)) return "electrode";
  if (/\bfoot pedal\b/.test(lower)) return "foot pedal";
  if (/\bground clamp\b|\bwork lead\b|\bground\b/.test(lower)) return "ground";
  if (/\bwire feed\b|\bwire cable\b|\bmig gun\b/.test(lower)) return "wire feed";
  if (/\bgas line\b|\bregulator\b|\bshielding gas\b|\bgas hose\b/.test(lower)) return "gas";
  return undefined;
}

export function tryDirectResponse(input: string): DirectResponse | null {
  const process = detectProcess(input);
  const visualType = classifyQuestion(input);
  const lower = input.toLowerCase();

  // Polarity / setup questions with a known process \u2014 always use the deterministic recipe.
  if (visualType === "polarity" && process !== "unknown") {
    const topic = extractSetupTopic(lower);
    return getDirectPolarityAnswer(process, topic);
  }

  // Duty cycle questions with amperage
  if (visualType === "duty-cycle") {
    const ampMatch = lower.match(/(\d+)\s*a(?:mp)?/i);
    const voltageMatch = /240/.test(lower) ? "240V" : "120V";
    if (ampMatch) {
      const amp = Number(ampMatch[1]);
      const result = getDutyCycleAnswerForAmperage(amp, voltageMatch);
      if (result) return result;
    }
    // Fallback: just provide the table
    return {
      visualType: "duty-cycle",
      answer: `Duty cycle limits depend on amperage and input voltage. At 120V, you get 40% duty at 100A or 100% at 75A. At 240V, you get 25% at 200A or 100% at 115A.`,
      dutyCycleRows,
      refs: [ownerRef("Duty cycle ratings", "7")]
    };
  }

  // Troubleshooting questions
  if (visualType === "troubleshooting") {
    if (/porosity|hole|pin/.test(lower)) {
      return getTroubleshootingAnswerForIssue("porosity");
    }
    if (/feed|bird|not feeding/.test(lower)) {
      return getTroubleshootingAnswerForIssue("wire");
    }
    return getTroubleshootingAnswerForIssue("badWeld");
  }

  // Process selection \u2014 only fires when classifyQuestion explicitly returned process-selection.
  // Setup/polarity wins above, so a TIG/MIG mention alone won\u2019t reach this branch.
  if (visualType === "process-selection") {
    return {
      visualType: "process-selection",
      answer: "Use MIG for easiest clean indoor welds, flux-core when you do not have gas or need outdoor welds, TIG for precision clean work, and stick for rugged thicker or dirty material.",
      refs: [selectionRef("Welding process selection chart"), selectionRef("Process comparison guide")],
      recommendedProcess: /no gas|outdoor/.test(lower) ? "flux-core" : /precision|stainless|aluminum/.test(lower) ? "tig" : "mig"
    };
  }

  // Wire loading / manual image questions
  if (visualType === "manual-image") {
    return {
      visualType: "manual-image",
      answer: "Load the spool so wire feeds cleanly into the inlet guide. Match the drive roller groove and contact tip to the wire diameter. Set tension so the wire bends 2-3 inches away from the tension point.",
      refs: [quickRef("Wire spool loading", "1"), ownerRef("Wire feed tension", "17")],
      manualImages: [manualImages[1]]
    };
  }

  return null;
}
