# Vulcan OmniPro 220 Multimodal Reasoning Assistant

This app is a Next.js garage-side agent for the Prox challenge. It combines:

- structured manual facts
- indexed manual visual knowledge
- planner-driven output selection
- optional Claude vision reasoning for uploads
- deterministic safety checks for polarity/setup

Goal: **read, think, and show** the answer clearly.

## Architecture

```text
app/page.tsx                        Chat UX + image upload + stop button
app/api/chat/route.ts               Main reasoning pipeline
lib/manualKnowledge.ts              Core manual facts (polarity/duty/settings/troubleshooting)
lib/manualImageIndex.ts             Structured visual knowledge index (manual pages/images)
lib/outputPlanner.ts                Intent + visual planner and structured cache key
lib/agentResponse.ts                Response schema + normalization + safety validation
lib/conversationState.ts            Clarification state (process/material/thickness)
components/VisualWorkspace.tsx      Planner-driven visual rendering
components/CustomSetupDiagram.tsx   Setup/polarity diagram (highlighted connections)
components/DutyCycleCard.tsx        Duty matrix with highlighted row + weld/rest indicator
components/ProcessSelectionMatrix.tsx Process comparison matrix
components/TroubleshootingFlow.tsx  Troubleshooting flow/checklist
components/SettingsRecommendationCard.tsx Settings card with exact/closest guidance
components/ImageDiagnosisPanel.tsx  Upload image diagnosis results
components/ManualImageCard.tsx      Manual page reference card
```

## Request Pipeline

1. User message (and optional image) is posted to `/api/chat`.
2. `outputPlanner` determines intent, visual type, required facts, and whether vision is needed.
3. System checks deterministic paths:
   - prebuilt intents
   - structured cache key: `intent|process|voltage|amperage|material|thickness`
   - direct knowledge retrieval
4. If needed, Claude is called with:
   - manual text context
   - manual image extracted facts from `manualImageIndex`
   - strict output JSON contract
5. If upload exists and planner requests vision, image is classified (weld defect / wiring / front panel / wire feed / unknown).
6. `normalizeAgentResponse` enforces answer-first style and validates safety-critical polarity facts.
7. UI renders visual artifact matching the plan (matrix/diagram/checklist/diagnosis card).

## Multimodal Knowledge

### `manualKnowledge`
Contains deterministic facts:

- polarity mappings per process
- duty cycle rows
- troubleshooting checks
- settings guidance

### `manualImageIndex`
Adds visual facts for key pages:

- front panel controls
- wire-feed interior / quick wire loading
- MIG / flux-core / TIG / stick setup diagrams
- duty chart
- weld diagnosis page
- process selection chart

Each entry includes:

- id, title, source, page, imagePath
- visual description + key labels
- related intents/processes
- extracted facts
- when to show it

This allows the agent to reason over image-derived manual facts, not just display image cards.

## Output Planner

`lib/outputPlanner.ts` maps message + context into:

- intent
- process
- requiredFacts
- visualType
- visualId
- needsClaudeVision
- needsClarification + clarificationQuestion

Visual types:

- `setup_diagram`
- `duty_cycle_matrix`
- `process_selection_matrix`
- `settings_card`
- `troubleshooting_flow`
- `image_diagnosis_panel`
- `manual_image_card`
- `none`

## Safety Validation

Before returning polarity/setup guidance, safety facts are validated.
If model output conflicts, deterministic templates replace the answer.

Validated mappings:

- TIG: ground clamp `+`, TIG torch `-`, wire feed disconnected
- Flux-core: ground clamp `+`, wire feed `-`
- MIG gas: ground clamp `-`, wire feed `+`, gas required
- Stick: ground clamp `-`, electrode holder `+`, wire feed disconnected

## Visual Confirmation Behavior

Visuals are never generic. They confirm the answer:

- Duty cycle: highlighted row + weld/rest indicator
- Setup: highlighted sockets/connections + disconnected warnings
- Process selection: highlighted recommended process
- Troubleshooting: first checks emphasized
- Image uploads: diagnosis panel with clues/checks/fixes/confidence

## Chat Response Style

Responses follow practical structure:

- direct answer first
- short steps
- common mistake
- next action
- sources as secondary references

## Run in Under 2 Minutes

```bash
cp .env.example .env
# add ANTHROPIC_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Validation Commands

```bash
npm run lint
npm run build
```

## Tested Prompts

- What’s the duty cycle for MIG welding at 200A on 240V?
- If I weld continuously at 200A, when do I need to stop?
- What polarity setup do I need for TIG welding?
- I’m using flux-core wire without gas. Which cable goes where?
- I’m getting porosity in my flux-cored welds. What should I check?
- How do I load the wire spool?
- How do I choose between MIG, flux-core, TIG, and stick?
- What settings should I use for 1/8 inch mild steel?
- Upload a weld bead photo and diagnose it.
- Upload a front panel photo and explain what I’m looking at.
