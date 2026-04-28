# OmniPro Assistant - Multimodal Technical Support Agent

## What this is

OmniPro Assistant is a support agent for the Vulcan OmniPro 220 welder.

The OmniPro 220 is powerful, but it has a lot of setup rules. MIG, flux-core, TIG, and stick all use different polarity. 120V and 240V have different duty-cycle limits. Wire feed, gas, material, thickness, and weld symptoms all change the right answer.

The manual has the information, but the information is spread across setup diagrams, duty-cycle tables, troubleshooting matrices, process charts, and weld diagnosis images.

This project turns that manual into a product support experience. The agent answers technical questions, shows diagrams and manual images, checks duty cycle, helps choose a process, walks through troubleshooting, and can inspect uploaded weld photos.

The goal is to make the welder usable in the garage without losing the precision of the manual.

## What makes this different

- It is built on the **Claude Agent SDK**, not a plain chat wrapper.
- The manual is modeled as structured product knowledge, not searched as raw PDF text.
- Diagrams, charts, and weld diagnosis images are indexed as facts.
- The app chooses the right output for the question: answer, setup diagram, manual image, duty-cycle calculator, checklist, troubleshooting flow, or image diagnosis.
- High-risk facts like polarity and duty cycle are deterministic and validated in code.
- The UI is built for someone standing next to the machine, not someone reading documentation at a desk.

## Demo

Hosted demo:

https://prox-challenge-gamma.vercel.app/

Try these:

- "What polarity setup do I need for TIG? Which socket does the ground clamp go in?"
- "What's the duty cycle for MIG welding at 200A on 240V?"
- "I'm getting porosity in my flux-cored welds. What should I check?"
- "I'm welding outdoors with no gas. What process should I use?"
- "Show me the wire feed mechanism."
- Upload a weld image and ask: "What defect is this?"

Expected behavior:

- TIG setup shows ground clamp to positive (+), TIG torch to negative (-), and wire feed disconnected.
- 200A on 240V returns 25% duty cycle: 2.5 minutes welding and 7.5 minutes resting in a 10-minute window.
- Flux-core porosity starts with polarity, clean metal, wire condition, contact tip, stick-out, and technique. It does not lead with MIG gas checks.

## How the system works

```text
User message + optional image
  -> planner classifies the job
  -> manual facts are retrieved
  -> visual facts are added when relevant
  -> Claude Agent SDK reasons with grounded context and tools
  -> response is normalized into typed visual specs
  -> React renders the correct support artifact
```

The model does not decide the whole interface by itself. The app routes the question first.

A polarity question gets a cable diagram. A duty-cycle question gets a duty-cycle card. A porosity question gets a troubleshooting flow and the weld diagnosis image. A request for a manual visual gets the actual indexed manual page. The model writes the final explanation, but the product logic controls the structure around it.

The Claude Agent SDK integration is in `lib/vulcanAgent.ts`. It creates a product-specific MCP server with two tools:

- `lookup_vulcan_manual_context`: returns curated manual facts and page references.
- `lookup_vulcan_visual_knowledge`: returns facts extracted from diagrams, charts, and manual images.

The main chat route is `app/api/chat/route.ts`. It streams responses as NDJSON. It also sends a preview event early so the visual workspace can prepare the right diagram before the full answer finishes.

Uploaded images use a separate Claude vision step. The image is compared against the weld diagnosis knowledge, then the diagnosis is passed into the main agent response. That lets the final answer include visible clues, likely issue, confidence, checks, and fixes.

## Design decisions

- **Use diagrams for spatial tasks**: cable setup is easier to understand visually. The app draws which lead goes into the positive or negative socket.
- **Keep safety-critical knowledge deterministic**: polarity, duty cycle rows, process constraints, and common warnings are stored in code. Claude explains them, but does not invent them.
- **Separate routing from reasoning**: the planner decides whether the answer needs a diagram, calculator, checklist, manual image, or plain text. Claude handles language and reasoning inside that structure.
- **Show the manual when the image matters**: setup diagrams, front panel controls, wire feed mechanism, process chart, and weld diagnosis page are shown directly.
- **Make troubleshooting step-by-step**: defects are represented as cause -> check -> fix. The user can work through the checks one at a time.
- **Support beginners without hiding technical detail**: Quick Setup asks for location, gas, material, and thickness, then recommends a process and checklist.
- **Show sources near the answer**: responses include manual page links so ratings and diagrams can be verified.
- **Design for real use**: the UI supports short answers, voice dictation, image upload, large visual cards, and checklists.

## Knowledge representation

The knowledge layer is hand-modeled from the provided manuals. I did this because many important facts are not plain paragraphs. They live in tables, diagrams, labels, and images.

Key files:

- `lib/manualKnowledge.ts`: polarity, duty cycle, process setup, manual references, settings, and troubleshooting facts.
- `lib/manualImageIndex.ts`: indexed manual images with page numbers, labels, related processes, extracted facts, and display rules.
- `lib/manualVisualKnowledge.ts`: visual facts from setup diagrams, process charts, wire feed views, and weld diagnosis examples.
- `lib/outputPlanner.ts`: intent router that maps a user question to a response type and visual type.
- `lib/quickSetup.ts`: deterministic setup recommendations from location, gas, material, and thickness.
- `lib/smartWarnings.ts`: warnings for common setup mistakes.
- `components/VisualWorkspace.tsx`: renders diagrams, calculators, manual images, and diagnosis panels from typed visual specs.

Examples of encoded facts:

- MIG uses DCEP: ground clamp -> negative (-), wire feed cable -> positive (+), shielding gas required.
- Flux-core uses DCEN: ground clamp -> positive (+), wire feed cable -> negative (-), no shielding gas.
- TIG uses DCEN: ground clamp -> positive (+), TIG torch -> negative (-), wire feed disconnected.
- Stick default setup: electrode holder -> positive (+), ground clamp -> negative (-), wire feed disconnected.
- 240V at 200A has a 25% duty cycle: 2.5 minutes weld, 7.5 minutes rest.

These values are reused by the agent prompt, diagrams, checklists, warnings, source chips, and response validation. They are not just copied into one long prompt.

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

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Verify:

```bash
npm run lint
npm run build
```

The app is a Next.js project. The main UI is `app/page.tsx`. The chat endpoint is `app/api/chat/route.ts`.

## Why this matters

Most product manuals are written for correctness, not for use in the moment.

For this welder, a useful assistant has to do more than answer in text:

- If the user asks where the TIG ground clamp goes, show the socket.
- If the user asks about 200A on 240V, turn the duty cycle into weld/rest time.
- If the user has porosity, order the checks for their process.
- If the answer depends on a diagram, show the diagram.
- If the user uploads a weld photo, reason from the visual clues.

This same approach can work for any technical product where support depends on diagrams, procedures, tables, and failure modes: welders, HVAC systems, EV chargers, lab equipment, industrial tools, and medical devices.

## Future work

- Add deeper extraction from the inside-door settings chart.
- Add richer overlays on manual images.
- Improve schematic-level reasoning for internal wiring diagrams.
- Store a user's machine setup, accessories, and common materials across sessions.
- Add an offline field mode for poor connectivity.

## Final note

I built this for the moment when someone is standing next to the welder and needs the next correct step.

The agent should be accurate enough to trust, visual enough to understand, and fast enough to use before striking an arc.
