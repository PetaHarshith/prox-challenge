// Curated fault states for the Vulcan OmniPro 220. The OmniPro 220 doesn't
// expose a numeric error-code system; instead it surfaces faults via front-
// panel indicators (HOT light, LCD warning screens, blank display) and the
// rear Reset Button. Each entry below is grounded in the manual's
// Troubleshooting and Specifications sections.
//
// Used by the FaultCodeBrowser modal (a quick-find UI for "the welder is
// doing something weird") and by FaultCodeCard (inline render in the chat
// bubble when a user picks an entry). Pure data — no LLM call required.

import type { ManualRef } from "./manualKnowledge";
import { ownerRef } from "./manualKnowledge";

export type FaultSeverity = "info" | "warning" | "danger";

export type FaultCode = {
  id: string;
  // Short token shown as the "code" chip (e.g. "HOT", "LV", "OV"). Not a
  // formal manufacturer code; a memorable handle the user can scan for.
  code: string;
  label: string;
  // Where on the welder this surfaces — helps the user confirm the match.
  indicator: string;
  severity: FaultSeverity;
  // Plain-language description of what the user is observing.
  whatYoureSeeing: string;
  // One-line "is it dangerous / am I safe?" answer.
  isSafe: string;
  // Likely root causes from the troubleshooting matrix.
  causes: string[];
  // Ordered recovery steps. Keep concise; user is in the garage.
  recovery: string[];
  // Search keywords (lowercased) for the browser's fuzzy filter.
  keywords: string[];
  refs: ManualRef[];
};

export const faultCodes: FaultCode[] = [
  {
    id: "thermal-overload",
    code: "HOT",
    label: "Thermal overload (duty cycle exceeded)",
    indicator: "HOT light on front panel; warning screen on LCD; output cuts mid-weld",
    severity: "warning",
    whatYoureSeeing: "The welder stopped putting out current and the HOT indicator is on. The internal thermal protection has tripped because the duty cycle was exceeded.",
    isSafe: "Safe. The machine protected itself. No damage as long as you let it cool with the fan running.",
    causes: [
      "Welded longer than the rated duty cycle for your amperage / input voltage.",
      "Fan blocked, dirty intake/exhaust vents, or insufficient airflow around the cabinet.",
      "Ambient temperature too high for the duty cycle you're pulling."
    ],
    recovery: [
      "Leave the Power Switch ON so the cooling fan keeps running.",
      "Wait until the HOT light clears (typically a few minutes).",
      "Check the duty-cycle table for your amperage and stay within it on the next run.",
      "Improve airflow: clear vents, move the welder out of cramped corners."
    ],
    keywords: ["hot", "overheat", "thermal", "duty cycle", "shut down", "stopped welding", "no output", "warning screen"],
    refs: [ownerRef("Troubleshooting – Wire Welding", "43"), ownerRef("Duty Cycle reference", "19"), ownerRef("Specifications", "7")]
  },
  {
    id: "low-voltage-protection",
    code: "LV",
    label: "Low-voltage protection tripped",
    indicator: "Welder won't function when switched on; warning screen or no arc on trigger",
    severity: "warning",
    whatYoureSeeing: "The input voltage dropped below the safe operating threshold and the machine entered low-voltage protection.",
    isSafe: "Safe. Operating below the rated voltage would damage the machine, so it locked itself out.",
    causes: [
      "Long or undersized extension cord causing voltage drop.",
      "Shared circuit pulling other loads (compressor, heater) at the same time.",
      "Wall outlet not delivering rated voltage (wiring issue or weak circuit)."
    ],
    recovery: [
      "Verify the outlet matches the welder's input rating (120V or 240V per Specifications, p.7).",
      "Remove the extension cord, or use a heavier-gauge / shorter one.",
      "Switch off other loads on the same circuit.",
      "Press the Reset Button on the back of the machine after the input is stable."
    ],
    keywords: ["low voltage", "lv", "won't power", "no arc", "extension cord", "reset", "wall outlet", "circuit"],
    refs: [ownerRef("Troubleshooting – Wire Welding / TIG / Stick", "43"), ownerRef("Specifications", "7")]
  },
  {
    id: "over-voltage-protection",
    code: "OV",
    label: "Over-voltage protection tripped",
    indicator: "Welder won't function when switched on; warning screen on LCD",
    severity: "warning",
    whatYoureSeeing: "The input voltage rose above the safe operating threshold and the machine entered over-voltage protection.",
    isSafe: "Safe. The lockout prevented damage to the inverter electronics.",
    causes: [
      "Plugged into a 240V circuit while set to expect 120V (or vice versa).",
      "Generator running unloaded or with bad voltage regulation.",
      "Surge or unstable supply from the wall."
    ],
    recovery: [
      "Confirm the outlet voltage matches what the welder is set up for (Specifications, p.7).",
      "If running off a generator, load it lightly first and let voltage settle.",
      "Press the Reset Button on the back of the machine.",
      "If it trips again, have a qualified electrician check the supply."
    ],
    keywords: ["over voltage", "ov", "high voltage", "generator", "surge", "won't power", "reset"],
    refs: [ownerRef("Troubleshooting – Wire Welding / TIG / Stick", "43"), ownerRef("Specifications", "7")]
  },
  {
    id: "no-power-on",
    code: "OFF",
    label: "Welder won't power on at all",
    indicator: "LCD blank, fan silent, no lights when Power Switch is ON",
    severity: "danger",
    whatYoureSeeing: "Nothing happens when you flip the Power Switch — display stays dark and the fan doesn't spin.",
    isSafe: "Don't open the cabinet. Check the supply side first; opening the welder voids the warranty and exposes high-voltage caps.",
    causes: [
      "Wall breaker tripped or GFCI tripped on the welder's circuit.",
      "Power cord not fully seated in the twist-lock, or damaged cord.",
      "Wrong outlet (e.g., 120V outlet when the welder is configured for 240V)."
    ],
    recovery: [
      "Reset the wall breaker / GFCI; identify and clear what tripped it before retrying.",
      "Reseat the twist-lock Power Cord on the back of the welder.",
      "Verify the outlet rating matches Specifications (p.7).",
      "If everything checks out and it's still dead, contact Harbor Freight service — do not open the cabinet."
    ],
    keywords: ["dead", "no power", "won't turn on", "blank screen", "breaker", "gfci", "power cord"],
    refs: [ownerRef("Troubleshooting – Wire Welding", "43"), ownerRef("Specifications", "7")]
  },
  {
    id: "wire-feed-fault",
    code: "FEED",
    label: "Wire won't feed (motor runs but no wire)",
    indicator: "You hear the drive motor but the wire stalls, slips, or birds-nests at the drive rolls",
    severity: "info",
    whatYoureSeeing: "Trigger pulls and the drive motor spins, but the wire isn't coming out of the gun smoothly.",
    isSafe: "Safe. This is a mechanical feed problem, not an electrical fault.",
    causes: [
      "Drive-roll tension set too low (wire slipping) or too high (wire flattened).",
      "Wrong roller groove size or type for the wire diameter (use knurled for flux-core).",
      "Worn or clogged contact tip, kinked liner, or wire spool tangled at the hub."
    ],
    recovery: [
      "Open the drive-roll cover and check the groove matches your wire diameter.",
      "Adjust drive-roll tension: just enough that you can stop the wire with a gloved hand at the gun tip.",
      "Inspect the contact tip — replace if the bore is worn oval.",
      "Reseat the spool, clear any tangles, confirm the wire path is clean from spool to gun."
    ],
    keywords: ["wire", "feed", "won't feed", "jam", "slip", "tangle", "bird nest", "drive roll", "tension", "spool"],
    refs: [ownerRef("Wire Loading & Drive Rolls", "27"), ownerRef("Troubleshooting – Wire Welding", "43")]
  },
  {
    id: "trigger-no-arc",
    code: "TRIG",
    label: "Trigger pulled, no arc",
    indicator: "Pulling the gun trigger does nothing — no wire feed, no arc, no contactor click",
    severity: "warning",
    whatYoureSeeing: "Trigger doesn't initiate the weld at all. The machine appears powered (LCD on) but there's no response.",
    isSafe: "Safe. Most causes are connection issues, not internal damage.",
    causes: [
      "Gun connector not fully seated in the front receptacle.",
      "Ground clamp not making good contact with clean bare metal on the workpiece.",
      "Wrong process selected on the Control Panel (e.g., set to Stick when using MIG gun).",
      "Trigger switch failed (rare — needs technician)."
    ],
    recovery: [
      "Power off, fully reseat and tighten the gun connector at the front of the welder.",
      "Re-clamp the ground to bare, clean metal as close to the weld as possible.",
      "Confirm the Control Panel shows the process you're actually trying to use.",
      "If it still won't fire after these checks, the trigger switch likely needs a qualified technician."
    ],
    keywords: ["trigger", "no arc", "nothing happens", "won't start", "ground clamp", "contactor", "connector"],
    refs: [ownerRef("Troubleshooting – Wire Welding", "43"), ownerRef("Troubleshooting – TIG / Stick", "43")]
  }
];

export function findFaultByKeyword(input: string): FaultCode | undefined {
  const text = input.toLowerCase().trim();
  if (!text) return undefined;
  return faultCodes.find((fault) =>
    fault.code.toLowerCase() === text ||
    fault.keywords.some((kw) => text.includes(kw) || kw.includes(text))
  );
}
