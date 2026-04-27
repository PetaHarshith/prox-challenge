# OmniPro Assistant — Multimodal Technical Support Agent

## What this is

Complex physical products require expert knowledge. For the Vulcan OmniPro 220, that knowledge is buried across a 48-page manual, setup diagrams, duty-cycle tables, troubleshooting matrices, weld photos, and process charts.

Manuals fail in the moment because they are not workflows. A user standing in a garage does not want to cross-reference polarity diagrams, amperage tables, and weld defect images before striking an arc.

OmniPro Assistant turns the manual into a usable support system. It answers questions, reasons over setup constraints, accepts uploaded weld images, and renders the right visual tool when text is the wrong interface.

## What makes this different

- Converts manual knowledge into reasoning, not retrieval
- Generates setup diagrams when wiring is spatial
- Uses manual images, charts, and diagrams as first-class knowledge
- Handles real constraints: indoor vs outdoor, gas vs no gas, material, thickness, process
- Designed for someone actually setting up the machine in a garage

## Demo

Hosted link: `<add hosted link>`

Video walkthrough: `<optional video link>`

Try:

- “What polarity setup do I need for TIG?”
- “I’m welding outdoors with no gas. What should I use?”
- “What’s the duty cycle at 200A on 240V?”
- “I’m getting porosity. What should I check?”
- Upload a weld image → “What defect is this?”

## How the system works

```text
User input (text + image)
  -> classify intent: setup, troubleshooting, duty cycle, process choice, image diagnosis
  -> retrieve structured knowledge: manual text + diagrams + tables
  -> reason over constraints
  -> generate structured output
  -> render the right visual: diagram, checklist, calculator, flow, or image diagnosis
```

Visuals are chosen intentionally. They are not added after the answer. If the task is wiring, the system draws wiring. If the task is duty cycle, it shows weld/rest time. If the task is troubleshooting, it gives a technician-style flow.

## Design decisions

- **Diagrams instead of paragraphs**: polarity setup is spatial. Users need to see which cable goes into which socket.
- **Troubleshooting flow**: weld defects are diagnosed by checking process, polarity, cleanliness, consumables, shielding, and technique in order.
- **Quick Setup**: beginners should not have to know whether they need MIG, flux-core, TIG, or stick before asking for help.
- **Warning system**: common mistakes are deterministic, so the app catches them directly: MIG without gas, flux-core with gas, wrong TIG polarity, continuous 200A welding.
- **Pre-Weld Checklist**: before the arc starts, the user can verify polarity, gas, wire, feed roller, contact tip, and workpiece prep.

## Knowledge representation

- `lib/manualKnowledge.ts`: structured facts for polarity, duty cycle, settings, process selection, and troubleshooting
- `lib/manualVisualKnowledge.ts`: extracted facts from diagrams, weld diagnosis images, setup illustrations, and charts
- `lib/manualImageIndex.ts`: index of manual visuals and when to show them
- `lib/quickSetup.ts`: deterministic garage setup rules for location, gas, material, and thickness
- `lib/smartWarnings.ts`: lightweight warnings for high-risk setup mistakes

Some critical knowledge exists only in diagrams. This is explicitly modeled instead of treated as decoration.

## Setup

```bash
git clone <your-fork>
cd <your-fork>
cp .env.example .env # add ANTHROPIC_API_KEY
npm install
npm run dev
```

## Why this matters

This is a small version of a technical product expert.

The same pattern can extend to HVAC systems, EV chargers, lab equipment, industrial tools, and any product where support depends on reading diagrams, interpreting symptoms, and applying setup rules.

The goal is to reduce dependence on human specialists by encoding their reasoning into a product-specific support system.

## Future work

- Richer visual reasoning over schematics and wiring overlays
- Voice interface for field use
- Deeper knowledge graph linking manuals, parts, symptoms, and field data

## Final note

This was built with the goal of making a complex machine usable without reading a 48-page manual.
