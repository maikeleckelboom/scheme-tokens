# AGENTS.md

## Repository stance

This package is greenfield and unpublished. Breaking changes are allowed when they simplify the final public contract.
Do not add deprecated aliases, compatibility wrappers, v0 readers, migration overloads, or hidden fallback branches.

Before adding new code, first check for existing functions, helpers, utilities, types, tests, and patterns that can be
reused or deleted.

## Current migration authority

The active v1 migration specification lives in:

`docs/v1-migration/`

For the v1 migration, read these files before editing implementation code:

1. `docs/v1-migration/00-CODEX-GOAL.md`
2. `docs/v1-migration/01-NORMATIVE-SPEC.md`
3. `docs/v1-migration/02-PUBLIC-API.md`
4. `docs/v1-migration/04-TEST-AND-RELEASE-GATE.md`
5. `docs/v1-migration/03-MIGRATION-PLAN.md`

`docs/v1-migration/99-SOURCE-CONVERSATION-ARCHIVE.md` is historical and non-normative. Do not copy superseded API names
or older vocabulary from it.

## Non-negotiable migration rules

- Root package behavior must work without Material 3 or color conversion imports.
- Root imports must not load optional capability dependencies.
- Public authoring data must stay JSON-safe.
- Public recoverable failures use `Result` with `issues`, not exceptions.
- `Issue.code` and JSON Pointer paths are contractual.
- Delete obsolete contracts outright instead of preserving old names.
- Do not publish, tag, create a GitHub release, or change repository visibility.
- Do not change the publication safety switch unless explicitly instructed.

## Validation

Run the strongest available validation before reporting completion:

```text
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

If validation scripts are changed during the migration, report both the old and new validation commands.

## Final report

Report:

- files changed
- validation commands run and results
- remaining risks
- git status
- suggested commit message
