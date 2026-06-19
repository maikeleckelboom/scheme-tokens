import { parseColorInput } from "./colorValue";
import { literalColor } from "./colorTokenValue";
import type {
  ColorSchemeTokenGraphInput,
  ModeValues,
  ModeValuesInput,
  Result,
  TokenNode,
  TokenNodeInput,
  ValidatedColorSchemeTokenGraph,
} from "./graph";
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
    | "invalid-color-input"
    | "invalid-color-token-value"
    | "invalid-color-value";
  readonly message: string;
  readonly key?: string;
  readonly mode?: string;
  readonly path?: string;
}

export type GraphValidationResult = Result<ValidatedColorSchemeTokenGraph, TokenGraphProblem>;

export function validateGraph(graph: ColorSchemeTokenGraphInput): GraphValidationResult {
  const problems: TokenGraphProblem[] = [];

  if (graph.schemaVersion !== "color-scheme-token-graph/v0") {
    problems.push({
      kind: "invalid-schema-version",
      message: "Graph schemaVersion must be color-scheme-token-graph/v0.",
      path: "schemaVersion",
    });
  }

  const modes = validateModes(graph, problems);
  const tokenKeys = validateTokenKeys(graph, problems);

  for (const [index, token] of graph.tokens.entries()) {
    validateToken(token, index, modes, tokenKeys, problems);
  }

  if (problems.length > 0) return { ok: false, problems };

  const normalizedGraph: ValidatedColorSchemeTokenGraph = {
    schemaVersion: graph.schemaVersion,
    modes: [...modes.values()],
    tokens: normalizeTokens(graph.tokens, modes, tokenKeys),
  };
  const cycleProblems = validateAliasTargets(normalizedGraph);

  return cycleProblems.length === 0
    ? { ok: true, value: normalizedGraph }
    : { ok: false, problems: cycleProblems };
}

function validateModes(
  graph: ColorSchemeTokenGraphInput,
  problems: TokenGraphProblem[],
): ReadonlyMap<string, ModeKey> {
  if (graph.modes.length === 0) {
    problems.push({
      kind: "empty-modes",
      message: "Graph modes must contain at least one mode.",
      path: "modes",
    });
  }

  const modes = new Map<string, ModeKey>();

  for (const [index, mode] of graph.modes.entries()) {
    const modeName = String(mode);
    const result = parseModeKey(modeName);

    if (!result.ok) {
      problems.push({
        kind: "invalid-mode-key",
        message: result.problems[0]?.message ?? "Invalid mode key.",
        mode: modeName,
        path: `modes.${index}`,
      });
      continue;
    }

    if (modes.has(modeName)) {
      problems.push({
        kind: "duplicate-mode-key",
        message: `Duplicate mode key: ${modeName}.`,
        mode: modeName,
        path: `modes.${index}`,
      });
      continue;
    }

    modes.set(modeName, result.value);
  }

  return modes;
}

function validateTokenKeys(
  graph: ColorSchemeTokenGraphInput,
  problems: TokenGraphProblem[],
): ReadonlyMap<string, TokenKey> {
  const tokenKeys = new Map<string, TokenKey>();

  for (const [index, token] of graph.tokens.entries()) {
    const key = String(token.key);
    const result = parseTokenKey(key);

    if (!result.ok) {
      problems.push({
        kind: "invalid-token-key",
        message: result.problems[0]?.message ?? "Invalid token key.",
        key,
        path: `tokens.${index}.key`,
      });
      continue;
    }

    if (tokenKeys.has(key)) {
      problems.push({
        kind: "duplicate-token-key",
        message: `Duplicate token key: ${key}.`,
        key,
        path: `tokens.${index}.key`,
      });
      continue;
    }

    tokenKeys.set(key, result.value);
  }

  return tokenKeys;
}

function validateToken(
  token: TokenNodeInput,
  index: number,
  modes: ReadonlyMap<string, ModeKey>,
  tokenKeys: ReadonlyMap<string, TokenKey>,
  problems: TokenGraphProblem[],
): void {
  if (token.kind === "color") {
    validateResolvedValues(
      token.values,
      String(token.key),
      `tokens.${index}.values`,
      modes,
      problems,
      (value, path) => {
        const result = parseColorInput(value, path);
        if (result.ok) return;

        for (const problem of result.problems) {
          problems.push({
            kind: problem.kind,
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
      String(token.key),
      `tokens.${index}.target`,
      modes,
      problems,
      (value, path, mode) => {
        const target = String(value);
        const result = parseTokenKey(target);
        if (!result.ok) {
          problems.push({
            kind: "invalid-token-key",
            message: result.problems[0]?.message ?? "Invalid token key.",
            key: String(token.key),
            ...(mode === undefined ? {} : { mode: String(mode) }),
            path,
          });
          return;
        }

        if (!tokenKeys.has(target)) {
          problems.push({
            kind: "unknown-alias-target",
            message: `Alias target does not exist: ${target}.`,
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
  value: Value | ModeValuesInput<Value>,
  key: string,
  path: string,
  modes: ReadonlyMap<string, ModeKey>,
  problems: TokenGraphProblem[],
  validateValue: (value: Value, path: string, mode?: ModeKey) => void,
): void {
  if (!Array.isArray(value)) {
    validateValue(value as Value, path);
    return;
  }

  const seenModes = new Set<string>();

  for (const [index, entry] of value.entries()) {
    const mode = String(entry.mode);
    const entryPath = `${path}.${index}`;
    const result = parseModeKey(mode);

    if (!result.ok) {
      problems.push({
        kind: "invalid-mode-value",
        message: result.problems[0]?.message ?? "Invalid mode key.",
        key,
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    if (seenModes.has(mode)) {
      problems.push({
        kind: "duplicate-mode-value",
        message: `Duplicate mode value for ${mode}.`,
        key,
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    seenModes.add(mode);

    const normalizedMode = modes.get(mode);
    if (normalizedMode === undefined) {
      problems.push({
        kind: "unknown-mode-value",
        message: `Mode value references unknown mode: ${mode}.`,
        key,
        mode,
        path: `${entryPath}.mode`,
      });
      continue;
    }

    validateValue(entry.value, `${entryPath}.value`, normalizedMode);
  }

  for (const mode of modes.keys()) {
    if (!seenModes.has(mode)) {
      problems.push({
        kind: "missing-mode-value",
        message: `Mode-specific token value is missing mode: ${mode}.`,
        key,
        mode,
        path,
      });
    }
  }
}

function normalizeTokens(
  tokens: readonly TokenNodeInput[],
  modes: ReadonlyMap<string, ModeKey>,
  tokenKeys: ReadonlyMap<string, TokenKey>,
): readonly TokenNode[] {
  return tokens.map((token) => {
    const key = tokenKeys.get(String(token.key)) as TokenKey;

    if (token.kind === "color") {
      return {
        kind: "color",
        key,
        values: normalizeModeValues(token.values, modes, (value) => {
          const result = parseColorInput(value);
          if (!result.ok) {
            throw new Error("Invalid color input reached graph normalization.");
          }
          return literalColor(result.value);
        }),
        ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
      };
    }

    return {
      kind: "alias",
      key,
      target: normalizeMaybeModeValues(
        token.target,
        modes,
        (value) => tokenKeys.get(String(value)) as TokenKey,
      ),
      ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
    };
  });
}

function normalizeMaybeModeValues<Input, Output>(
  value: Input | ModeValuesInput<Input>,
  modes: ReadonlyMap<string, ModeKey>,
  normalizeValue: (value: Input) => Output,
): Output | ModeValues<Output> {
  if (!Array.isArray(value)) return normalizeValue(value as Input);
  return normalizeModeValues(value, modes, normalizeValue);
}

function normalizeModeValues<Input, Output>(
  values: ModeValuesInput<Input>,
  modes: ReadonlyMap<string, ModeKey>,
  normalizeValue: (value: Input) => Output,
): ModeValues<Output> {
  return values.map((entry) => ({
    mode: modes.get(String(entry.mode)) as ModeKey,
    value: normalizeValue(entry.value),
  }));
}

function validateAliasTargets(graph: ValidatedColorSchemeTokenGraph): readonly TokenGraphProblem[] {
  const problems: TokenGraphProblem[] = [];
  const tokenMap = new Map(graph.tokens.map((token) => [String(token.key), token]));

  for (const token of graph.tokens) {
    for (const mode of graph.modes) {
      detectAliasCycle(token, mode, tokenMap, problems);
    }
  }

  return problems;
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
