# OmniPro Assistant - Multimodal Welder Support Agent

OmniPro Assistant is a local Next.js app for helping a non-expert use and troubleshoot the Vulcan OmniPro 220 welder. It answers practical questions from the welder manuals, supports uploaded images, and renders focused visual tools when the answer is easier to understand visually.

The OmniPro 220 manual has the right information, but it is spread across setup diagrams, duty-cycle charts, process tables, troubleshooting pages, and safety notes. That makes it hard to answer garage-side questions like "which cable goes where?" or "why does this weld look wrong?" without flipping between sections.

This project turns that manual into an interactive assistant. The agent combines manual text, structured facts, diagram knowledge, and image reasoning to give direct answers, show the relevant visual workspace, and ask targeted follow-up questions only when the missing detail matters.

## Key Features

- Multimodal chat with text and image upload
- Manual-grounded answers for the Vulcan OmniPro 220
- Generated setup and polarity diagrams
- Interactive duty cycle calculator and table
- Troubleshooting flows for common weld problems
- Process selection matrix for MIG, flux-core, TIG, and stick
- Settings and configuration guidance
- Manual image reasoning over diagrams, photos, and charts
- Conversation handling for ambiguity and missing setup details

## Architecture

The app is intentionally small and easy to inspect.

- `app/page.tsx` - Next.js app router frontend, chat UI, image upload, and visual workspace state
- `app/api/chat/route.ts` - API route that runs the Claude reasoning path and returns structured output
- `lib/manualKnowledge.ts` - structured manual facts for polarity, duty cycle, settings, and troubleshooting
- `lib/manualVisualKnowledge.ts` and `lib/manualImageIndex.ts` - curated facts extracted from important manual diagrams, photos, and charts
- `lib/outputPlanner.ts` - intent and visual planner that decides what kind of answer and artifact should be shown
- `components/VisualWorkspace.tsx` - renders diagrams, tables, flows, diagnosis cards, and manual image references
- `lib/agentResponse.ts` - response normalization and safety validation for setup-sensitive answers

Safety-critical polarity guidance is validated deterministically before it is returned. If a model response conflicts with known manual wiring facts, the deterministic answer wins.

## How the Agent Works

```text
User question + optional image
  -> classify intent
  -> gather manual text + visual facts
  -> Claude reasoning
  -> structured response
  -> render chat answer + visual artifact
```

Visuals are not decoration. The planner chooses them based on the question:

- Polarity questions show setup diagrams.
- Duty-cycle questions show the calculator/table.
- Troubleshooting questions show guided checks.
- Process-choice questions show the process matrix.
- Uploaded weld images show diagnosis support and relevant manual references.

## Design Decisions

- Diagrams are generated instead of only showing manual pages because users need the active cable path, polarity, and disconnected components called out clearly.
- Duty cycle is rendered as a calculator/table because the useful answer is a time tradeoff, not a paragraph.
- Troubleshooting is a guided flow because weld defects usually require checking process, polarity, cleanliness, consumables, and technique in order.
- Ambiguous questions ask targeted clarifications when process, voltage, material, or thickness changes the answer.
- Safety-critical setup facts are validated deterministically because cable polarity should not depend on model wording alone.

## Demo Prompts

- What's the duty cycle for MIG welding at 200A on 240V?
- What polarity setup do I need for TIG welding?
- I'm using flux-core wire without gas. Which cable goes where?
- I'm getting porosity in my flux-cored welds. What should I check?
- How do I choose between MIG, flux-core, TIG, and stick?
- I'm welding 1/8 mild steel outdoors with no gas at 200A on 240V. Which process should I use, how should I wire it, and how can I weld longer?
- Upload a weld image and ask: What specific defect is this, and what should I fix first?

## Setup

```bash
git clone <repo-url>
cd prox-challenge
cp .env.example .env
```

Add your Anthropic API key to `.env`:

```bash
ANTHROPIC_API_KEY=your-api-key-here
```

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app runs locally with one API key.

## Environment Variables

```bash
ANTHROPIC_API_KEY=
```

Optional:

```bash
ANTHROPIC_MODEL=
```

If `ANTHROPIC_MODEL` is not set, the API route uses its default Claude model.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Limitations and Future Work

- Manual visual facts are curated for the most important diagrams, charts, and troubleshooting references.
- Settings recommendations are conservative when the exact manual value is unavailable.
- Future work could add deeper settings extraction, richer image overlays, and more complete schematic parsing.

## Submission Notes

The goal was to build something useful for a non-expert standing in a garage, not just a text chatbot. The assistant tries to answer directly, show the right supporting artifact, and keep setup-sensitive guidance tied to the manual.
