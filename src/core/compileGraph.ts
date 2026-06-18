import type { ColorValue } from "./colorValue";
import type { ColorSchemeTokenGraph, ModeValues, Result, TokenNode } from "./graph";
import type { TokenKey } from "./keys";
import type { ModeKey } from "./modes";
import type { TokenProvenance } from "./provenance";
import { validateGraph } from "./validateGraph";

export interface CompileOptions {
  readonly include?: readonly TokenKey[];
}

export interface CompileProblem {
  readonly kind:
    | "invalid-graph"
    | "unknown-include-token"
    | "duplicate-include-token"
    | "unknown-token"
    | "missing-mode-value"
    | "alias-cycle";
  readonly message: string;
  readonly key?: string;
  readonly mode?: string;
}

export interface CompiledModeColorValue {
  readonly mode: ModeKey;
  readonly value: ColorValue;
}

export interface CompiledColorToken {
  readonly key: TokenKey;
  readonly values: readonly CompiledModeColorValue[];
  readonly provenance?: TokenProvenance;
}

export interface CompiledTokenSet {
  readonly schemaVersion: "compiled-color-scheme-tokens/v0";
  readonly modes: readonly ModeKey[];
  readonly tokens: readonly CompiledColorToken[];
}

export type CompileResult = Result<CompiledTokenSet, CompileProblem>;

export function compileGraph(
  graph: ColorSchemeTokenGraph,
  options: CompileOptions = {},
): CompileResult {
  const validation = validateGraph(graph);
  if (!validation.ok) {
    return {
      ok: false,
      problems: validation.problems.map((problem) => ({
        kind: "invalid-graph",
        message: problem.message,
        ...(problem.key === undefined ? {} : { key: problem.key }),
        ...(problem.mode === undefined ? {} : { mode: problem.mode }),
      })),
    };
  }

  const tokenMap = new Map(graph.tokens.map((token) => [String(token.key), token]));
  const problems: CompileProblem[] = [];
  const requestedTokens = resolveRequestedTokens(graph, options, tokenMap, problems);
  const compiledTokens: CompiledColorToken[] = [];

  for (const token of requestedTokens) {
    const values: CompiledModeColorValue[] = [];

    for (const mode of graph.modes) {
      const resolved = resolveTokenColor(token, mode, tokenMap, []);

      if ("problem" in resolved) {
        problems.push(resolved.problem);
        continue;
      }

      values.push({ mode, value: resolved.value });
    }

    if (values.length === graph.modes.length) {
      compiledTokens.push(withOptionalProvenance({ key: token.key, values }, token.provenance));
    }
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      schemaVersion: "compiled-color-scheme-tokens/v0",
      modes: [...graph.modes],
      tokens: compiledTokens,
    },
  };
}

function resolveRequestedTokens(
  graph: ColorSchemeTokenGraph,
  options: CompileOptions,
  tokenMap: ReadonlyMap<string, TokenNode>,
  problems: CompileProblem[],
): readonly TokenNode[] {
  if (options.include === undefined) return graph.tokens;

  const seen = new Set<string>();
  const tokens: TokenNode[] = [];

  for (const key of options.include) {
    const keyName = String(key);

    if (seen.has(keyName)) {
      problems.push({
        kind: "duplicate-include-token",
        message: `Duplicate include token: ${keyName}.`,
        key: keyName,
      });
      continue;
    }

    seen.add(keyName);
    const token = tokenMap.get(keyName);

    if (token === undefined) {
      problems.push({
        kind: "unknown-include-token",
        message: `Included token does not exist: ${keyName}.`,
        key: keyName,
      });
      continue;
    }

    tokens.push(token);
  }

  return tokens;
}

function resolveTokenColor(
  token: TokenNode,
  mode: ModeKey,
  tokenMap: ReadonlyMap<string, TokenNode>,
  stack: readonly string[],
): { readonly value: ColorValue } | { readonly problem: CompileProblem } {
  if (token.kind === "color") {
    const value = readModeValue(token.value, mode);
    if (value !== undefined) return { value };

    return {
      problem: {
        kind: "missing-mode-value",
        message: `Token ${String(token.key)} is missing mode ${String(mode)}.`,
        key: String(token.key),
        mode: String(mode),
      },
    };
  }

  const key = String(token.key);
  if (stack.includes(key)) {
    return {
      problem: {
        kind: "alias-cycle",
        message: `Alias cycle detected for mode ${String(mode)}: ${[...stack, key].join(" -> ")}.`,
        key,
        mode: String(mode),
      },
    };
  }

  const targetKey = readModeValue(token.target, mode);
  if (targetKey === undefined) {
    return {
      problem: {
        kind: "missing-mode-value",
        message: `Alias ${key} is missing mode ${String(mode)}.`,
        key,
        mode: String(mode),
      },
    };
  }

  const target = tokenMap.get(String(targetKey));
  if (target === undefined) {
    return {
      problem: {
        kind: "unknown-token",
        message: `Alias target does not exist: ${String(targetKey)}.`,
        key,
        mode: String(mode),
      },
    };
  }

  return resolveTokenColor(target, mode, tokenMap, [...stack, key]);
}

function readModeValue<Value>(value: Value | ModeValues<Value>, mode: ModeKey): Value | undefined {
  if (!Array.isArray(value)) return value as Value;
  return (value as ModeValues<Value>).find((entry) => entry.mode === mode)?.value;
}

function withOptionalProvenance(
  token: Omit<CompiledColorToken, "provenance">,
  provenance: TokenProvenance | undefined,
): CompiledColorToken {
  return provenance === undefined ? token : { ...token, provenance };
}
