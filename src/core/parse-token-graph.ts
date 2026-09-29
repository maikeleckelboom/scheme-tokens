import type { TokenGraph, TokenGraphIssue, TokenLayer } from "./graph";
import { readPlainRecord } from "./json";
import type { Result } from "./result";
import { validateSourceGraph, validateSourceLayer, type ValidatedSource } from "./validate-source";
import { upgradeV1Graph, upgradeV1Layer } from "./upgrade-v1-source";
import { composeTokenGraph } from "./compose-token-graph";
import { resolveTokenGraph } from "./resolve-token-graph";

export function parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphIssue> {
  let source: Result<ValidatedSource<TokenGraph>, TokenGraphIssue>;
  if (isV1(input)) {
    const old = validateSourceGraph(input, { version: 1 });
    if (!old.ok) {
      return old;
    }
    const upgraded = upgradeV1Graph(old.value.artifact);
    source = validateSourceGraph(upgraded.artifact, { paths: upgraded.paths });
  } else {
    source = validateSourceGraph(input);
  }
  if (!source.ok) {
    return source;
  }
  const resolved = resolveTokenGraph(composeTokenGraph(source.value));
  return resolved.ok ? { ok: true, value: source.value.artifact } : resolved;
}

export function parseTokenLayer(input: unknown): Result<TokenLayer, TokenGraphIssue> {
  let source: Result<ValidatedSource<TokenLayer>, TokenGraphIssue>;
  if (isV1(input)) {
    const old = validateSourceLayer(input, { version: 1 });
    if (!old.ok) {
      return old;
    }
    source = validateSourceLayer(upgradeV1Layer(old.value.artifact));
  } else {
    source = validateSourceLayer(input);
  }
  return source.ok ? { ok: true, value: source.value.artifact } : source;
}

function isV1(input: unknown): boolean {
  const entries = readPlainRecord(input, { code: "invalid-object" });
  return (
    entries.ok && entries.value.some((entry) => entry.key === "formatVersion" && entry.value === 1)
  );
}
