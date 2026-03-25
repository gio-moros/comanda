# c-stack

`c-stack` is a Comanda-native workflow pack inspired by Garry Tan's `gstack` command set.
Instead of cloning the original shell-heavy setup, these workflows map the same specialist roles
onto Comanda's built-in CLI agents: `claude-code`, `gemini-cli`, and `openai-codex`.

## Included Workflows

- `office-hours.yaml` - Founder-style product triage for raw ideas
- `plan-ceo-review.yaml` - Strategic review for a proposed plan
- `plan-eng-review.yaml` - Engineering review for architecture and execution
- `plan-design-review.yaml` - Design review for UX, taste, and implementation detail
- `autoplan.yaml` - Runs the three plan reviews and produces one integrated plan
- `review.yaml` - Multi-agent code or diff review
- `qa-only.yaml` - QA-focused release validation plan
- `ship.yaml` - Release-manager style rollout and rollback runbook

## Quick Start

Run product office hours on a new idea:

```bash
cat idea.md | comanda process examples/c-stack/office-hours.yaml
```

Run the full planning stack:

```bash
cat plan.md | comanda process examples/c-stack/autoplan.yaml
```

Run a review on a staged diff:

```bash
git diff --cached | comanda process examples/c-stack/review.yaml
```

Run QA or release planning:

```bash
cat release-brief.md | comanda process examples/c-stack/qa-only.yaml
cat release-brief.md | comanda process examples/c-stack/ship.yaml
```

## Notes

- Each workflow writes intermediate artifacts under `examples/c-stack/artifacts/`.
- Final synthesized output is also printed to `STDOUT`.
- `autoplan.yaml` composes the three review sub-workflows using Comanda's `process` step.
