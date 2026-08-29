# HYBRIDSYSTEM

HYBRIDSYSTEM is a React and TypeScript application for operating hybrid human and AI teams. It demonstrates a multi-tenant autonomous team OS with deterministic playbooks, model-routed agents, job queues, human approval gates, metered execution, persistent team memory, and generated mission artifacts.

## What The App Includes

- Mission launcher with reusable playbooks and custom goals
- Simulated worker loop that advances mission steps through queued, running, approval, and done states
- Human-in-the-loop approval cards for high-authority actions
- Team roster editor for agent names, models, prompts, tools, and authority levels
- Team memory workflow for proposed, approved, dismissed, and revoked memory facts
- Blueprint and settings views for architecture, cost caps, and tool governance
- Local persistence through browser storage so demo state survives refreshes

## Run Locally

```bash
bun install
bun run dev
```

The development server starts on port `3000` by default.

If you prefer npm:

```bash
npm install
npm run dev
```

## Build

```bash
bun run build
```

or:

```bash
npm run build
```

## Sunday Demo Flow

1. Open the Missions tab and start with the active mission queue.
2. Launch a new mission from a playbook and show how the workflow becomes a deterministic step graph.
3. Execute the next worker step to show the autonomous loop.
4. Open a mission detail page and review outputs, costs, tokens, tools, and authority tiers.
5. Resolve an approval gate to show where human control overrides automation.
6. Visit Team Roster and Team Memory to show governance, persistence, and auditability.

## Tech Stack

- Vite
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React icons
- React Markdown
