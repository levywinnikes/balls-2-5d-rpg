# AI Runbook

## Purpose

This runbook defines the mandatory execution flow for AI-assisted tasks in this repository.
Use it before any code change to reduce regressions and keep contracts, validation, and documentation aligned.

## Mandatory Read Order (Before Editing)

1. [AI_READ_FIRST.md](./AI_READ_FIRST.md)
2. [PROJECT_CONTRACT.md](./PROJECT_CONTRACT.md)
3. Relevant files in [docs/contracts](./contracts/)
4. [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md)
5. [VALIDATION_MATRIX.md](./VALIDATION_MATRIX.md)

If the task touches maps, UI, benchmark flows, save/load, or transitions, read the corresponding domain contract first.

## Task Classification

Classify the task before editing:

1. `docs-only`
2. `bugfix`
3. `refactor`
4. `feature`
5. `performance/benchmark`

Use the highest-impact classification when in doubt.

## Non-Negotiable Rules

- Do not introduce hardcoded player-facing UI text; use translation keys.
- Treat item text, quest text, and NPC dialogue as localization-required domains.
- Update affected contracts in the same task when behavior or rules change.
- Preserve architecture boundaries defined in contracts.
- Keep changes minimal and scoped.
- Do not close a task without required validation commands.

## Execution Flow

1. Read contracts and classify impact.
2. Define impacted modules using [ARCHITECTURE_MAP.md](./ARCHITECTURE_MAP.md).
3. Select required validations using [VALIDATION_MATRIX.md](./VALIDATION_MATRIX.md).
4. Implement the smallest safe change.
5. Run required validations.
6. Update contracts/docs if any rule or behavior changed.
7. Summarize scope, module impact, validations, and residual risk in the task output.

## Required Task Output

Every completed task summary should include:

- Scope: what changed and why.
- Module impact: impacted modules and boundaries reviewed.
- Files touched.
- Validation commands executed and their result.
- Contract files reviewed/updated.
- Residual risks or follow-ups.
