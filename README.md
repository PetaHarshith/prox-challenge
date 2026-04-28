# OmniPro Assistant - Multimodal Technical Support Agent

## What this is

OmniPro Assistant is a product support agent for the Vulcan OmniPro 220 welder.

The OmniPro 220 can run MIG, flux-core, TIG, and stick. It also changes behavior based on input voltage, amperage, polarity, gas, wire type, and material thickness. That makes the manual hard to use in the moment. A person in a garage usually does not want to read 48 pages before making one cable connection.

This project turns the manual into an interactive support experience. The agent answers technical questions, shows the right diagram or manual image, checks duty cycle limits, walks through troubleshooting, and can inspect uploaded weld photos.

The goal is simple: make the machine easier to use without making the answer less precise.

## What makes this different

- It is not a PDF search box. The manual is represented as structured product knowledge.
- It uses the Claude Agent SDK with product-specific tools for manual and visual lookup.
- It chooses the output format based on the job: text, wiring diagram, duty-cycle calculator, checklist, flow, manual image, or image diagnosis.
- It treats diagrams as facts. Polarity setups, socket locations, wire feed views, and weld diagnosis images are indexed and surfaced when useful.
- It has deterministic safety checks for common mistakes like wrong polarity, MIG without gas, flux-core with gas, or welding too long at 200A.
- It is built around the garage workflow. The UI gives the next useful step instead of a long explanation.

## Demo

Run locally:

```bash
npm install
npm run dev
```

Then open the local URL printed by Next.js.

Good test questions:

- "What polarity setup do I need for TIG? Which socket does the ground clamp go in?"
- "What's the duty cycle for MIG welding at 200A on 240V?"
- "I'm getting porosity in my flux-cored welds. What should I check?"
- "I'm welding outdoors with no gas. What process should I use?"
- "Show me the wire feed mechanism."
- Upload a weld image and ask: "What defect is this?"

Expected examples:

- TIG: ground clamp goes to positive (+), TIG torch goes to negative (-), wire feed disconnected.
- 200A on 240V: 25% duty cycle, so 2.5 minutes welding and 7.5 minutes resting per 10 minutes.
- Flux-core porosity: check DCEN polarity first, then clean metal, dry/clean wire, contact tip, stick-out, and drag angle.

## How the system works

```text
User message + optional image
  -> output planner classifies the job
  -> structured manual facts are retrieved
  -> indexed visual facts are added when relevant
  -> Claude Agent SDK reasons with the grounded context and tools
  -> server normalizes the response into a typed visual spec
  -> React renders the right support artifact
```

The main idea is that the model should not decide everything from scratch.

The app first routes the request. A duty-cycle question should render a duty-cycle card. A polarity question should render a cable diagram. A porosity question should render a troubleshooting flow and the weld diagnosis image. The model writes the explanation, but the product logic controls the structure around it.

The Claude Agent SDK integration lives in `lib/vulcanAgent.ts`. It exposes two product tools:

- `lookup_vulcan_manual_context`: retrieves curated manual facts and references.
- `lookup_vulcan_visual_knowledge`: retrieves facts extracted from manual diagrams, charts, and weld images.

The API route in `app/api/chat/route.ts` streams the answer as NDJSON. It also sends an early preview event so the visual workspace can prepare the right diagram before the full answer is finished.

Image uploads use a separate Claude vision pass. The image is compared against the weld diagnosis knowledge, then the result is passed back into the main agent response so the final answer can include visible clues, likely causes, checks, and fixes.

## Design decisions

- **Use visuals when space matters**: cable polarity is not best explained as prose. The app draws the positive and negative sockets and shows which lead goes where.
- **Keep high-risk facts deterministic**: polarity, duty cycle rows, and process constraints are stored in code. Claude can explain them, but it should not invent them.
- **Separate routing from reasoning**: the planner decides whether the response needs a diagram, calculator, manual image, checklist, or plain answer. Claude focuses on the user's wording and the final explanation.
- **Use the manual image when the manual image is the product**: setup pages, the front panel, wire feed compartment, and weld diagnosis chart are shown directly instead of recreated from memory.
- **Make troubleshooting actionable**: weld defects are turned into cause -> check -> fix items. The user can work through them one at a time.
- **Support beginners without dumbing it down**: Quick Setup asks for location, gas, material, and thickness, then recommends a process and checklist. It does not require the user to already know the welding process.
- **Show sources near the answer**: manual page links are included so the user can verify the rating, diagram, or setup procedure.
- **Design for dirty hands**: the UI supports short answers, large visual cards, voice dictation, image upload, and checklists.

## Knowledge representation

The knowledge layer is hand-modeled from the provided manuals. I chose this over raw PDF retrieval because many important facts are visual, tabular, or conditional.

- `lib/manualKnowledge.ts`: core structured facts for polarity, duty cycle, process setup, manual references, settings, and troubleshooting.
- `lib/manualImageIndex.ts`: index of manual images, page numbers, labels, extracted facts, related processes, and when each image should be shown.
- `lib/manualVisualKnowledge.ts`: visual reasoning facts from setup diagrams, process charts, wire feed views, and weld diagnosis examples.
- `lib/outputPlanner.ts`: intent router that maps a user question to a response type and visual type.
- `lib/quickSetup.ts`: deterministic setup recommendations from location, gas, material, and thickness.
- `lib/smartWarnings.ts`: warning rules for common unsafe or incorrect setups.
- `components/VisualWorkspace.tsx`: renders the structured visual specs into diagrams, calculators, manual images, and diagnosis panels.

Examples of encoded knowledge:

- MIG uses DCEP: ground clamp -> negative (-), wire feed cable -> positive (+), shielding gas required.
- Flux-core uses DCEN: ground clamp -> positive (+), wire feed cable -> negative (-), no shielding gas.
- TIG uses DCEN: ground clamp -> positive (+), TIG torch -> negative (-), wire feed disconnected.
- Stick default setup: electrode holder -> positive (+), ground clamp -> negative (-), wire feed disconnected.
- 240V at 200A has a 25% duty cycle: 2.5 minutes weld, 7.5 minutes rest.

The important part is that these are not just strings in a prompt. They are structured values used by diagrams, checklists, warnings, and answer validation.

## Setup

Requirements:

- Node.js 20.9 or newer
- An Anthropic API key

Create the environment file:

```bash
cp .env.example .env
```

Add your key:

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Install and run:

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run lint
npm run build
```

The app runs as a Next.js project. The chat endpoint is `app/api/chat/route.ts`, and the main UI is `app/page.tsx`.

## Why this matters

Technical products often fail at the support layer. The answer exists somewhere in the manual, but the user needs it in the right form at the right time.

For the OmniPro 220, that means:

- not just "use TIG polarity," but showing the torch and ground sockets;
- not just "25% duty cycle," but turning that into weld/rest time;
- not just "porosity has many causes," but ordering the checks for the user's process;
- not just "see page 37," but showing the weld diagnosis image beside the answer.

This pattern can apply to any complex product with diagrams, procedures, tables, and failure modes: welders, HVAC systems, EV chargers, lab equipment, medical devices, and industrial tools.

## Future work

- Add a hosted demo and short walkthrough video.
- Improve schematic-level reasoning for internal wiring diagrams.
- Add richer overlays on top of manual images.
- Add more exact settings from the inside-door chart and process selection chart.
- Add persistent conversation memory for a user's machine, accessories, and common materials.
- Add offline/local mode for job sites with poor connectivity.

## Final note

I built this as if someone just bought the welder, opened the box, and needed real help before striking an arc.

The agent should be accurate enough to trust, visual enough to understand, and simple enough to use while standing next to the machine.
