# OmniPro Assistant

A garage-side expert for the Vulcan OmniPro 220: ask a question, get the answer, the diagram, the checklist, or the manual image that actually helps.

Hosted Website: <https://prox-challenge-gamma.vercel.app/>

Video Demo: <https://drive.google.com/file/d/1jidbqLx1CTExQaUbTLbZFz1nkJ1g19-9/view?usp=sharing/>

Built in one focused day.

## What this is

The OmniPro 220 is not a simple tool. It supports MIG, flux-core, TIG, and stick. It runs on 120V and 240V. Each process has different polarity, gas, wire-feed, and duty-cycle rules.

The manual has the answers, but the answers are spread across tables, setup diagrams, troubleshooting charts, process-selection pages, and weld defect images.

OmniPro Assistant turns that manual into a garage-side support experience. It answers technical questions, shows the right visual, and helps the user take the next correct step without reading the whole manual.

The system is designed for fast, in-context use: answers are short, visual, and immediately actionable.

## What it can do

- Answer polarity questions and draw the cable setup.
- Show the real manual image when the answer depends on a diagram.
- Calculate duty cycle and convert it into weld/rest time.
- Compare MIG, flux-core, TIG, and stick setups in a table.
- Render pre-weld checklists for one process or all four processes.
- Walk through porosity, spatter, wire-feed, and bad-weld troubleshooting.
- Diagnose uploaded weld photos with Claude vision.
- Recommend a process from location, gas, material, and thickness.
- Surface fault states like HOT, low voltage, over voltage, no power, no arc, and wire-feed faults.
- Warn about common mistakes before they become bad welds.

Try:

- `What polarity setup do I need for TIG? Which socket does the ground clamp go in?`
- `What's the duty cycle for MIG welding at 200A on 240V?`
- `I'm getting porosity in my flux-cored welds. What should I check?`
- `Explain all four setups.`
- `Show me the wire feed mechanism.`
- Upload a weld photo and ask: `What defect is this?`

## How it works

```text
User question + optional image
  -> classify the job
  -> retrieve manual + visual facts
  -> call Claude through the Agent SDK
  -> return typed answer + visual specs
  -> render the support artifact
```

The important design choice is that Claude does not own the whole product behavior.

The app decides what kind of help the user needs first. A duty-cycle question gets a duty-cycle card. A polarity question gets a wiring diagram. A manual-image request gets the real manual page. A multi-process setup question gets short bullets, a comparison table, setup diagrams, and checklist pages.

Claude writes the explanation and handles language. The product layer controls the facts, visuals, and safety-critical structure.

## Agent architecture

The Claude Agent SDK is integrated in `lib/vulcanAgent.ts`.

It exposes a small set of product-specific tools:

- `lookup_vulcan_manual_context`
- `lookup_vulcan_visual_knowledge`

These tools give Claude access to curated manual facts and extracted diagram knowledge, instead of relying on generic reasoning.

The main API route (`app/api/chat/route.ts`) handles routing, calls the agent, and streams structured JSON events to the frontend so both the answer and visual workspace update in real time.

Uploaded images follow a separate multimodal path. The image is first analyzed using Claude Vision and classified against known weld defect categories. That structured diagnosis (issue, visual clues, confidence, checks, fixes) is then injected back into the main agent response.

This lets the final answer combine:

- visual evidence from the image
- grounded manual knowledge
- structured troubleshooting steps

## Knowledge model

The manual is represented as structured product knowledge instead of raw PDF chunks.

Key files:

- `lib/manualKnowledge.ts` - polarity, duty cycle, setup facts, settings guidance, troubleshooting, and manual refs.
- `lib/manualImageIndex.ts` - manual images, page numbers, labels, extracted facts, related processes, and display rules.
- `lib/manualVisualKnowledge.ts` - facts from diagrams, process charts, wire-feed images, and weld diagnosis examples.
- `lib/outputPlanner.ts` - routes questions to the right response type and visual artifact.
- `lib/quickSetup.ts` - deterministic process recommendation and pre-weld checklists.
- `lib/smartWarnings.ts` - rules for common high-risk mistakes.
- `lib/faultCodes.ts` - practical fault-state browser for common machine symptoms.

Examples of encoded facts:

- MIG: ground clamp -> negative, wire feed cable -> positive, shielding gas required.
- Flux-core: ground clamp -> positive, wire feed cable -> negative, no shielding gas.
- TIG: ground clamp -> positive, TIG torch -> negative, wire feed disconnected.
- Stick: electrode holder -> positive, ground clamp -> negative, wire feed disconnected.
- 240V at 200A: 25% duty cycle, so 2.5 minutes weld and 7.5 minutes rest.

These facts feed the prompt, diagrams, comparison tables, checklists, warnings, source chips, and response validation. They are not copied into one giant prompt and forgotten.

## Product decisions

**Diagrams for wiring.**  
Polarity is spatial. Users should see which lead goes into which socket.

**Manual images when the image matters.**  
The wire-feed mechanism, front panel, setup pages, and weld diagnosis chart are shown directly from the manual.

**Deterministic safety facts.**  
Claude can explain polarity and duty cycle, but it does not get to invent them.

**Short answer first.**  
The user is in a garage. The first sentence should answer the question. The extra UI carries the detail.

**Visuals are part of the response, not decoration.**  
The server returns typed visual specs. React renders diagrams, calculators, tables, checklists, and image cards from those specs.

**Beginner path without dumbing it down.**  
Quick Setup asks four questions: location, gas, material, thickness. Then it recommends a process, wiring, gas setup, next step, and checklist.

**No fake precision.**  
When exact wire speed or voltage is not grounded in the extracted manual data, the app gives setup guidance and tells the user to use the machine's auto/synergic setting or chart instead of hallucinating numbers.

## UI

The app is built as a support cockpit:

- Chat on the left.
- Visual workspace on the right.
- Inline tables and checklists inside the conversation.
- Tabs for setup, duty cycle, and settings.
- Image upload for weld diagnosis.
- Voice dictation for hands-busy use.
- Quick Setup modal for users who do not know which process to choose.
- Fault Code browser for common machine symptoms.

This is meant to feel like a technical support expert standing next to the welder, not a document search page.

## Running locally

Requirements:

- Node.js 20.9+
- Anthropic API key

```bash
git clone <your-fork>
cd <your-fork>
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

Verify:

```bash
npm run lint
npm run build
```

## Expected answers

The app should answer the core challenge questions like this:

- **200A on 240V:** 25% duty cycle, 2.5 minutes welding, 7.5 minutes resting.
- **TIG ground clamp:** positive (+) socket. TIG torch goes to negative (-). Wire feed stays disconnected.
- **Flux-core porosity:** check DCEN polarity first, then clean metal, wire condition, contact tip/nozzle, stick-out, and drag angle. Do not lead with MIG gas checks.
- **All four setups:** brief bullets, setup comparison table, pre-weld checklist pager, setup diagrams, and manual setup images.

## Why this matters

Complex products do not just need better search. They need support that understands what the user is trying to do and can present the answer in the right form.

For the OmniPro 220, sometimes that form is a sentence. Sometimes it is a table. Sometimes it is a wiring diagram. Sometimes it is the manual image itself.

That is the core idea behind this project.
