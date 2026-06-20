# color-scheme-tokens v1 migration package

**Prepared:** 2026-06-19  
**Repository:** `maikeleckelboom/color-scheme-tokens`  
**Audited baseline:** `8d03d468c05e9dcbcc54759339129c55bcabbcf7`  
**Status:** normative implementation brief for a greenfield, pre-publication breaking migration

This package replaces the design conversation as the durable source of truth for the `color-scheme-tokens` v1 migration. It contains the final vocabulary, data model, public API, color semantics, optional capability boundaries, migration sequence, test plan, release gate, examples, and the rationale behind accepted and rejected alternatives.

The original conversation is preserved in `99-SOURCE-CONVERSATION-ARCHIVE.md` for provenance only. It is intentionally **non-normative** because it contains earlier proposals that were later superseded.

## How to use this package with Codex

1. Copy this directory into the repository, preferably as `docs/v1-migration/`.
2. Give Codex the contents of `00-CODEX-GOAL.md` as the `/goal` instruction.
3. Keep all files available in the working tree while Codex works.
4. Do not give the conversation archive equal authority to the normative files.
5. Do not publish or tag from the automated migration run.

## Authority and precedence

When two statements appear to conflict, use this order:

1. `00-CODEX-GOAL.md` — execution contract and completion criteria.
2. `01-NORMATIVE-SPEC.md` — architecture and behavioral semantics.
3. `02-PUBLIC-API.md` — exact public vocabulary, signatures, and entry points.
4. `04-TEST-AND-RELEASE-GATE.md` — executable acceptance criteria.
5. `03-MIGRATION-PLAN.md` — implementation sequence and repository mapping.
6. `08-SEMVER-AND-MAINTENANCE.md` — post-publication compatibility policy.
7. `05-USAGE-EXAMPLES.md` — examples that must compile against the packed package.
8. `06-DECISION-LOG.md` — rationale and superseded alternatives.
9. `07-CURRENT-STATE-AUDIT.md` — audited starting state, not desired behavior.
10. `99-SOURCE-CONVERSATION-ARCHIVE.md` — historical record only.

Later normative decisions deliberately supersede earlier conversation vocabulary. In particular:

| Superseded                                                   | Final                                  |
| ------------------------------------------------------------ | -------------------------------------- |
| `Problem`, `problems`                                        | `Issue`, `issues`                      |
| `schemaVersion`                                              | `formatVersion`                        |
| `values`                                                     | `valueByMode`                          |
| `compileGraph`                                               | `compileTokenGraph`                    |
| `createSchemeTokens`                                         | `buildTokenSet`                        |
| `exportTokenSetJson`                                         | `serializeTokenSet`                    |
| generic `prefix`                                             | `variablePrefix` / `classPrefix`       |
| alias token nodes                                            | reference expressions `{ ref: "…" }`   |
| layers and overlay semantics                                 | fragments with duplicate-key rejection |
| helper DSL (`ref`, `byMode`, `publicToken`, `internalToken`) | direct JSON-safe authoring data        |

## Package contents

- `00-CODEX-GOAL.md` — paste-ready one-shot goal.
- `01-NORMATIVE-SPEC.md` — complete v1 architecture and domain contract.
- `02-PUBLIC-API.md` — exact runtime/type surface and issue catalog.
- `03-MIGRATION-PLAN.md` — phased implementation plan and deletion map.
- `04-TEST-AND-RELEASE-GATE.md` — mandatory test matrix and release checklist.
- `05-USAGE-EXAMPLES.md` — end-to-end intended API examples.
- `06-DECISION-LOG.md` — accepted decisions, rejected alternatives, future scope.
- `07-CURRENT-STATE-AUDIT.md` — current repository findings at the audited baseline.
- `08-SEMVER-AND-MAINTENANCE.md` — compatibility policy after first publication.
- `99-SOURCE-CONVERSATION-ARCHIVE.md` — complete source conversation, non-normative.
- `COLOR-SCHEME-TOKENS-V1-MIGRATION-BIBLE.md` — all normative files combined.

## Normative language

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in their ordinary requirements sense. A MUST is an acceptance criterion, not a suggestion.

## Scope boundary

This migration produces a deterministic, color-specific token graph compiler with optional conversion and Material 3 capabilities. It does not generalize the package to typography, dimensions, arbitrary DTCG token types, asynchronous sources, global plugins, or user-injected color engines.
