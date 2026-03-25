# Comanda Workflow Visualizer

This is a small React + Tailwind UI for visualizing Comanda workflows and agent orchestrators.

## What It Does

- Paste or upload a Comanda workflow YAML file
- Load built-in samples inspired by the repo's multi-agent and `c-stack` workflows
- Load workflow YAML directly from the Comanda server via `/workflows` and `/files/content`
- Resolve linked `process.workflow_file` references so sub-workflows stay part of the same flow
- Visualize sequential stages, parallel groups, and loop orchestrators
- Inspect node inputs, outputs, dependencies, and execution shape
- Generate new workflows from the UI via the server's `/generate` endpoint
- Start a saved server workflow or the current editor draft directly from the UI

## Run

```bash
cd ui
npm install
npm run dev
```

When running the UI with Vite, API calls to `/workflows`, `/files/content`, `/generate`,
`/process`, `/yaml/process`, and `/ui/config` are proxied to `http://localhost:8080` by default.

## Build

```bash
cd ui
npm run build
```

## Serve Through Comanda

Build the UI, start the Comanda server, then open `/ui/`:

```bash
cd ui
npm install
npm run build

cd ..
comanda server
```

Then visit `http://localhost:8080/ui/`.
