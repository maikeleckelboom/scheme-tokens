import { validateColorValue } from "./colorValue";
import type { ColorSchemeTokenGraph, ModeValues, TokenNode } from "./graph";
import type { TokenKey } from "./keys";
import { parseTokenKey } from "./keys";
import type { ModeKey } from "./modes";
import { parseModeKey } from "./modes";

export interface TokenGraphProblem {
  readonly kind:
    | "invalid-schema-version"
    | "empty-modes"
    | "invalid-mode-key"
    | "duplicate-mode-key"
    | "invalid-token-key"
    | "duplicate-token-key"
    | "invalid-token-kind"
    | "invalid-mode-value"
    | "duplicate-mode-value"
    | "missing-mode-value"
    | "unknown-mode-value"
    | "unknown-alias-target"
    | "alias-cycle"
    | "invalid-color-value";
  readonly message: string;
  readonly key?: string;
  readonly mode?: string;
  readonly path?: string;
}

export type GraphValidationResult =
  | { readonly ok: true; readonly graph: ColorSchemeTokenGraph }
  | { readonly ok: false; readonly problems: readonly TokenGraphProblem[] };

export function validateGraph(graph: ColorSchemeTokenGraph): GraphValidationResult {
  const problems: TokenGraphProblem[] = [];

  if (graph.schemaVersion !== "color-scheme-token-graph/v0") {
    problems.push({
      kind: "invalid-schema-version",
      message: "Graph schemaVersion must be color-scheme-token-graph/v0.",
      path: "schemaVersion",
    });
  }

  const modes = validateModes(graph, problems);
  const tokenMap = validateTokenKeys(graph, problems);

  for (const [index, token] of graph.tokens.entries()) {
    validateToken(token, index, modes, tokenMap, problems);
  }

  validateAliasTargets(graph, modes, tokenMap, problems);

  return problems.length === 0 ? { ok: true, graph } : { ok: false, problems };
}

function validateModes(
  graph: ColorSchemeTokenGraph,
  problems: TokenGraphProblem[],
): readonly ModeKey[] {
  if (graph.modes.length === 0) {
    problems.push({
      kind: "empty-modes",
      message: "Graph modes must contain at least one mode.",
      path: "modes",
    });
  }

  const seen = new Set<string>();
  const validModes: ModeKey[] = [];

  for (const [index, mode] of graph.modes.entries()) {
    const modeName = String(mode);
    const result = parseModeKey(modeName);

    if (!result.ok) {
      problems.push({
        kind: "invalid-mode-key",
        message: result.problem.message,
        mode: modeName,
        path: `modes.${index}`,
      });
      continue;
    }

    if (seen.has(modeName)) {
      problems.push({
        kind: "duplicate-mode-key",
        message: `Duplicate mode key: ${modeName}.`,
        mode: modeName,
        path: `modes.${index}`,
      });
      continue;
    }

    seen.add(modeName);
    validModes.push(result.value);
  }

  return validModes;
}

function validateTokenKeys(
  graph: ColorSchemeTokenGraph,
  problems: TokenGraphProblem[],
): ReadonlyMap<string, TokenNode> {
  const tokenMap = new Map<string, TokenNode>();

  for (const [index, token] of graph.tokens.entries()) {
    const key = String(token.key);
    const result = parseTokenKey(key);

    if (!result.ok) {
      problems.push({
        kind: "invalid-token-key",
        message: result.problem.message,
        key,
        path: `tokens.${index}.key`,
      });
      continue;
    }

    if (tokenMap.has(key)) {
      problems.push({
        kind: "duplicate-token-key",
        message: `Duplicate token key: ${key}.`,
        key,
        path: `tokens.${index}.key`,
      });
      continue;
    }

    tokenMap.set(key, token);
  }

  return tokenMap;
}

function validateToken(
  token: TokenNode,
  index: number,
  modes: readonly ModeKey[],
  tokenMap: ReadonlyMap<string, TokenNode>,
  problems: TokenGraphProblem[],
): void {
  if (token.kind === "color") {
    validateResolvedValues(
      token.value,
      token.key,
      `tokens.${index}.value`,
      modes,
      problems,
      (value, path) => {
        for (const problem of validateColorValue(value, path)) {
          problems.push({
            kind: "invalid-color-value",
            message: problem.message,
            key: String(token.key),
            ...(problem.path === undefined ? {} : { path: problem.path }),
          });
        }
      },
    );
    return;
  }

  if (token.kind === "alias") {
    validateResolvedValues(
      token.target,
      token.key,
      `tokens.${index}.target`,
      modes,
      problems,
      (value, path, mode) => {
        const result = parseTokenKey(String(value));
        if (!result.ok) {
          problems.push({
            kind: "invalid-token-key",
            message: result.problem.message,
            key: String(token.key),
            ...(mode === undefined ? {} : { mode: String(mode) }),
            path,
          });
          return;
        }

        if (!tokenMap.has(String(value))) {
          problems.push({
            kind: "unknown-alias-target",
            message: `Alias target does not exist: ${String(value)}.`,
            key: String(token.key),
            ...(mode === undefined ? {} : { mode: String(mode) }),
            path,
          });
        }
      },
    );
    return;
  }

  problems.push({
    kind: "invalid-token-kind",
    message: `Unsupported token kind at tokens.${index}.`,
    path: `tokens.${index}.kind`,
  });
}

function validateResolvedValues<Value>(
  value: Value | ModeValues<Value>,
  key: TokenKey,
  path: string,
  modes: readonly ModeKey[],
  problems: TokenGraphProblem[],
  validateValue: (value: Value, path: string, mode?: ModeKey) => void,
): void {
  if (!Array.isArray(value)) {
    validateValue(value as Value, path);
    return;
  }

  const graphModes = new Set(modes.map(String));
  const seenModes = new Set<string>();

  for (const [index, entry] of value.entries()) {
    const mode = String(entry.mode);
    const entryPath = `${path}.${index}`;
    const result = parseModeKey(mode);

    if (!result.ok) {
      problems.push({
        kind: "invalid-mode-value",
        message: result.problem.message,
        key: String(key),
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    if (seenModes.has(mode)) {
      problems.push({
        kind: "duplicate-mode-value",
        message: `Duplicate mode value for ${mode}.`,
        key: String(key),
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    seenModes.add(mode);

    if (!graphModes.has(mode)) {
      problems.push({
        kind: "unknown-mode-value",
        message: `Mode value references unknown mode: ${mode}.`,
        key: String(key),
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    validateValue(entry.value, `${entryPath}.value`, result.value);
  }

  for (const mode of modes) {
    if (!seenModes.has(String(mode))) {
      problems.push({
        kind: "missing-mode-value",
        message: `Mode-specific token value is missing mode: ${String(mode)}.`,
        key: String(key),
        mode: String(mode),
        path,
      });
    }
  }
}

function validateAliasTargets(
  graph: ColorSchemeTokenGraph,
  modes: readonly ModeKey[],
  tokenMap: ReadonlyMap<string, TokenNode>,
  problems: TokenGraphProblem[],
): void {
  for (const token of graph.tokens) {
    for (const mode of modes) {
      detectAliasCycle(token, mode, tokenMap, problems);
    }
  }
}

function detectAliasCycle(
  token: TokenNode,
  mode: ModeKey,
  tokenMap: ReadonlyMap<string, TokenNode>,
  problems: TokenGraphProblem[],
): void {
  const visited: string[] = [];
  let current: TokenNode | undefined = token;

  while (current?.kind === "alias") {
    const key = String(current.key);
    const existingIndex = visited.indexOf(key);

    if (existingIndex !== -1) {
      const cycle = [...visited.slice(existingIndex), key];
      problems.push({
        kind: "alias-cycle",
        message: `Alias cycle detected for mode ${String(mode)}: ${cycle.join(" -> ")}.`,
        key,
        mode: String(mode),
      });
      return;
    }

    visited.push(key);
    const target = readModeValue(current.target, mode);
    if (target === undefined) return;
    current = tokenMap.get(String(target));
  }
}

function readModeValue<Value>(value: Value | ModeValues<Value>, mode: ModeKey): Value | undefined {
  if (!Array.isArray(value)) return value as Value;
  return (value as ModeValues<Value>).find((entry) => entry.mode === mode)?.value;
}
