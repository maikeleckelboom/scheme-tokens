import type { CompiledColorScheme, ParseCompiledSchemeIssue } from "../core/compiled-types";
import { isClassPrefix, isDataAttributeName, isSingleSegmentIdentifier } from "../core/identifiers";
import { compareCodeUnits, escapePointerSegment, readPlainRecord } from "../core/json";
import { parseCompiledScheme } from "../core/parse-compiled-scheme";
import type { Issue, Result } from "../core/result";
import { describeUnknown } from "../core/unknown-description";
import { formatCssColor } from "./format-css-color";
import { isValidCssSelector } from "./selector-validation";

export type CssScope =
  | {
      readonly strategy: "root";
    }
  | {
      readonly strategy: "selector";
      readonly selector: string;
    };

export type CssModeSelectors =
  | {
      readonly strategy: "data-attribute";
      readonly attribute: string;
    }
  | {
      readonly strategy: "class";
      readonly classPrefix: string;
    }
  | {
      readonly strategy: "selectors";
      readonly selectors: Readonly<Record<string, string>>;
    };

export interface CssVariableNameInput<Key extends string = string> {
  readonly tokenKey: Key;
  readonly segments: readonly [string, ...string[]];
  readonly defaultName: string;
  readonly prefix?: string;
}

export interface ExportCssVarsOptions<Key extends string = string> {
  readonly prefix?: string;
  readonly variableName?: (input: CssVariableNameInput<Key>) => string;
  readonly scope?: CssScope;
  readonly modeSelectors?: CssModeSelectors;
  readonly format?: "pretty" | "compact";
}

export interface CssVarDeclaration<Key extends string = string> {
  readonly tokenKey: Key;
  readonly property: string;
  readonly value: string;
}

export interface CssVarBlock<Key extends string = string> {
  readonly mode: string;
  readonly selector: string;
  readonly declarations: readonly CssVarDeclaration<Key>[];
}

export interface CssVarsExport<Key extends string = string> {
  readonly css: string;
  readonly blocks: readonly CssVarBlock<Key>[];
  readonly variableByToken: Readonly<Record<Key, string>>;
}

export type ExportCssVarsIssue =
  | ParseCompiledSchemeIssue
  | (Issue<
      | "invalid-css-options"
      | "invalid-css-prefix"
      | "invalid-css-variable"
      | "duplicate-css-variable"
      | "invalid-scope"
      | "invalid-selector"
      | "invalid-data-attribute"
      | "invalid-class-prefix"
      | "invalid-mode-selectors"
      | "missing-mode-selector"
      | "unknown-mode-selector"
      | "duplicate-mode-selector"
    > & {
      readonly key?: string;
      readonly firstKey?: string;
      readonly mode?: string;
      readonly property?: string;
      readonly selector?: string;
    });

export function exportCssVars<const Scheme extends CompiledColorScheme>(
  scheme: Scheme,
  options?: ExportCssVarsOptions<Extract<keyof Scheme["tokens"], string>>,
): Result<CssVarsExport<Extract<keyof Scheme["tokens"], string>>, ExportCssVarsIssue>;
export function exportCssVars(
  scheme: CompiledColorScheme,
  options?: ExportCssVarsOptions,
): Result<CssVarsExport, ExportCssVarsIssue>;
export function exportCssVars(
  scheme: CompiledColorScheme,
  options?: ExportCssVarsOptions,
): Result<CssVarsExport, ExportCssVarsIssue> {
  const parsedScheme = parseCompiledScheme(scheme);
  if (!parsedScheme.ok) {
    return parsedScheme;
  }

  const parsed = parseOptions(parsedScheme.value, options);
  if (!parsed.ok) {
    return parsed;
  }

  const variables = buildVariableMap(parsedScheme.value, parsed.value);
  if (!variables.ok) {
    return variables;
  }

  const blocks = buildCssVarBlocks(parsedScheme.value, parsed.value, variables.value);
  if (!blocks.ok) {
    return blocks;
  }

  return {
    ok: true,
    value: {
      css: formatBlocks(blocks.value, parsed.value.compact),
      blocks: blocks.value,
      variableByToken: variables.value,
    },
  };
}

function buildVariableMap(
  scheme: CompiledColorScheme,
  options: ParsedCssOptions,
): Result<Readonly<Record<string, string>>, ExportCssVarsIssue> {
  const tokenKeys = Object.keys(scheme.tokens).sort(compareCodeUnits);
  const variables: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const key of tokenKeys) {
    const segments = key.split(".") as [string, ...string[]];
    const defaultName = defaultCssVariableName(segments, options.prefix);
    let property: unknown;
    try {
      property =
        options.variableName?.({
          tokenKey: key,
          segments,
          defaultName,
          ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
        }) ?? defaultName;
    } catch {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-css-variable",
            message: "variableName must return a CSS custom property name.",
            key,
          },
        ],
      };
    }
    if (typeof property !== "string" || !isSafeCssCustomPropertyName(property)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-css-variable",
            message: "Generated CSS variable names must be safe custom properties.",
            key,
            property: typeof property === "string" ? property : describeUnknown(property),
          },
        ],
      };
    }
    const firstKey = seen.get(property);
    if (firstKey !== undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "duplicate-css-variable",
            message: "Generated CSS variable names must be unique.",
            key,
            firstKey,
            property,
          },
        ],
      };
    }
    seen.set(property, key);
    variables[key] = property;
  }
  return { ok: true, value: variables };
}

function buildCssVarBlocks(
  scheme: CompiledColorScheme,
  options: ParsedCssOptions,
  variableByToken: Readonly<Record<string, string>>,
): Result<readonly CssVarBlock[], ExportCssVarsIssue> {
  const tokenKeys = Object.keys(scheme.tokens).sort(compareCodeUnits);
  const blocks: CssVarBlock[] = [];
  for (const mode of scheme.modes) {
    const selector = options.selectors[mode];
    if (selector === undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "missing-mode-selector",
            message: `Missing selector for mode: ${mode}.`,
            mode,
          },
        ],
      };
    }

    const declarations: CssVarDeclaration[] = [];
    for (const key of tokenKeys) {
      const token = scheme.tokens[key];
      const property = variableByToken[key];
      const value = token?.valueByMode[mode];
      if (token === undefined || property === undefined || value === undefined) {
        return {
          ok: false,
          issues: [
            {
              code: "invalid-object",
              message: "Compiled color scheme is missing a parsed token value.",
              path:
                token === undefined
                  ? `/tokens/${escapePointerSegment(key)}`
                  : `/tokens/${escapePointerSegment(key)}/valueByMode/${escapePointerSegment(mode)}`,
            },
          ],
        };
      }
      declarations.push({
        tokenKey: key,
        property,
        value: formatCssColor(value),
      });
    }
    blocks.push({
      mode,
      selector,
      declarations,
    });
  }
  return { ok: true, value: blocks };
}

function formatBlocks(blocks: readonly CssVarBlock[], compact: boolean): string {
  return compact
    ? blocks.map((block) => formatBlock(block, true)).join("")
    : `${blocks.map((block) => formatBlock(block, false)).join("\n\n")}\n`;
}

function formatBlock(block: CssVarBlock, compact: boolean): string {
  const declarations = block.declarations.map((declaration) =>
    compact
      ? `${declaration.property}:${declaration.value};`
      : `  ${declaration.property}: ${declaration.value};`,
  );
  return compact
    ? `${block.selector}{${declarations.join("")}}`
    : [`${block.selector} {`, ...declarations, "}"].join("\n");
}

interface ParsedCssOptions {
  readonly prefix?: string;
  readonly variableName?: (input: CssVariableNameInput) => unknown;
  readonly selectors: Readonly<Record<string, string>>;
  readonly compact: boolean;
}

function parseOptions(
  scheme: CompiledColorScheme,
  options: ExportCssVarsOptions | undefined,
): Result<ParsedCssOptions, ExportCssVarsIssue> {
  const entries =
    options === undefined
      ? ({ ok: true, value: [] } as const)
      : readPlainRecord(options, {
          code: "invalid-css-options",
          message: "CSS options must be a plain object.",
        });
  if (!entries.ok) {
    return entries as Result<never, ExportCssVarsIssue>;
  }

  for (const entry of entries.value) {
    if (
      entry.key !== "prefix" &&
      entry.key !== "variableName" &&
      entry.key !== "scope" &&
      entry.key !== "modeSelectors" &&
      entry.key !== "format"
    ) {
      return {
        ok: false,
        issues: [{ code: "invalid-css-options", message: `Unknown CSS option: ${entry.key}.` }],
      };
    }
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const prefix = record.get("prefix");
  if (
    prefix !== undefined &&
    (typeof prefix !== "string" || (prefix !== "" && !isSingleSegmentIdentifier(prefix)))
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-css-prefix",
          message: "prefix must be a lower-kebab single segment.",
        },
      ],
    };
  }
  const variableNameInput = record.get("variableName");
  if (variableNameInput !== undefined && typeof variableNameInput !== "function") {
    return {
      ok: false,
      issues: [{ code: "invalid-css-options", message: "variableName must be a function." }],
    };
  }
  const variableName =
    typeof variableNameInput === "function"
      ? (input: CssVariableNameInput) => variableNameInput(input)
      : undefined;
  const format = record.get("format") ?? "pretty";
  if (format !== "pretty" && format !== "compact") {
    return {
      ok: false,
      issues: [{ code: "invalid-css-options", message: "format must be pretty or compact." }],
    };
  }

  const modeSelectors = record.get("modeSelectors");
  const scope = record.get("scope");
  const selectors = parseSelectors(scheme, scope, modeSelectors);
  if (!selectors.ok) {
    return selectors;
  }

  return {
    ok: true,
    value: {
      ...(typeof prefix === "string" && prefix !== "" ? { prefix } : {}),
      ...(variableName === undefined ? {} : { variableName }),
      selectors: selectors.value,
      compact: format === "compact",
    },
  };
}

function parseSelectors(
  scheme: CompiledColorScheme,
  scopeInput: unknown,
  modeSelectorsInput: unknown,
): Result<Readonly<Record<string, string>>, ExportCssVarsIssue> {
  const modeSelector = modeSelectorsInput ?? {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  };
  const selectorStrategy = readPlainRecord(modeSelector, {
    code: "invalid-mode-selectors",
    message: "modeSelectors must be a plain object.",
  });
  if (!selectorStrategy.ok) {
    return selectorStrategy as Result<never, ExportCssVarsIssue>;
  }
  const strategyRecord = new Map(selectorStrategy.value.map((entry) => [entry.key, entry.value]));
  const strategy = strategyRecord.get("strategy");

  if (strategy === "selectors") {
    if (scopeInput !== undefined) {
      return {
        ok: false,
        issues: [{ code: "invalid-scope", message: "scope must be omitted with exact selectors." }],
      };
    }
    return parseExactSelectors(scheme, strategyRecord.get("selectors"));
  }

  const scope = parseScope(scopeInput);
  if (!scope.ok) {
    return scope;
  }

  if (strategy === "data-attribute") {
    const attribute = strategyRecord.get("attribute");
    if (typeof attribute !== "string" || !isDataAttributeName(attribute)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-data-attribute",
            message: "data attribute must be a safe data-* attribute.",
          },
        ],
      };
    }
    return generatedSelectors(
      scheme,
      (mode) => `${scope.value}[${attribute}="${mode}"]`,
      scope.value,
    );
  }

  if (strategy === "class") {
    const classPrefix = strategyRecord.get("classPrefix");
    if (typeof classPrefix !== "string" || !isClassPrefix(classPrefix)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-class-prefix",
            message: "classPrefix must be a lower-kebab prefix ending in '-'.",
          },
        ],
      };
    }
    return generatedSelectors(
      scheme,
      (mode) => `${scope.value}.${classPrefix}${mode}`,
      scope.value,
    );
  }

  return {
    ok: false,
    issues: [{ code: "invalid-mode-selectors", message: "Unsupported mode selector strategy." }],
  };
}

function parseScope(input: unknown): Result<string, ExportCssVarsIssue> {
  if (input === undefined) {
    return { ok: true, value: ":root" };
  }
  const entries = readPlainRecord(input, {
    code: "invalid-scope",
    message: "scope must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, ExportCssVarsIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (record.get("strategy") === "root" && record.size === 1) {
    return { ok: true, value: ":root" };
  }
  if (
    record.get("strategy") === "selector" &&
    record.size === 2 &&
    typeof record.get("selector") === "string"
  ) {
    const selector = record.get("selector") as string;
    return isValidCssSelector(selector)
      ? { ok: true, value: selector }
      : {
          ok: false,
          issues: [{ code: "invalid-selector", message: "Invalid CSS selector.", selector }],
        };
  }
  return { ok: false, issues: [{ code: "invalid-scope", message: "Invalid scope strategy." }] };
}

function parseExactSelectors(
  scheme: CompiledColorScheme,
  input: unknown,
): Result<Readonly<Record<string, string>>, ExportCssVarsIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-mode-selectors",
    message: "selectors must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, ExportCssVarsIssue>;
  }

  const modeSet = new Set(scheme.modes);
  const selectors: Record<string, string> = {};
  for (const entry of entries.value) {
    if (!modeSet.has(entry.key)) {
      return {
        ok: false,
        issues: [
          {
            code: "unknown-mode-selector",
            message: `Unknown mode selector: ${entry.key}.`,
            mode: entry.key,
          },
        ],
      };
    }
    if (typeof entry.value !== "string" || !isValidCssSelector(entry.value)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-selector",
            message: "Invalid CSS selector.",
            mode: entry.key,
            selector: typeof entry.value === "string" ? entry.value : describeUnknown(entry.value),
          },
        ],
      };
    }
    selectors[entry.key] = entry.value;
  }
  for (const mode of scheme.modes) {
    if (selectors[mode] === undefined) {
      return {
        ok: false,
        issues: [
          { code: "missing-mode-selector", message: `Missing selector for mode: ${mode}.`, mode },
        ],
      };
    }
  }
  return rejectDuplicateSelectors(selectors);
}

function generatedSelectors(
  scheme: CompiledColorScheme,
  selectorForMode: (mode: string) => string,
  defaultSelector: string,
): Result<Readonly<Record<string, string>>, ExportCssVarsIssue> {
  const selectors: Record<string, string> = {};
  for (const mode of scheme.modes) {
    selectors[mode] = mode === scheme.defaultMode ? defaultSelector : selectorForMode(mode);
  }
  return rejectDuplicateSelectors(selectors);
}

function rejectDuplicateSelectors(
  selectors: Readonly<Record<string, string>>,
): Result<Readonly<Record<string, string>>, ExportCssVarsIssue> {
  const seen = new Map<string, string>();
  for (const [mode, selector] of Object.entries(selectors)) {
    const first = seen.get(selector);
    if (first !== undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "duplicate-mode-selector",
            message: "Mode selectors must be unique.",
            mode,
            selector,
          },
        ],
      };
    }
    seen.set(selector, mode);
  }
  return { ok: true, value: selectors };
}

function defaultCssVariableName(
  segments: readonly [string, ...string[]],
  prefix: string | undefined,
): string {
  const encodedKey = segments.join("--");
  return prefix === undefined ? `--${encodedKey}` : `--${prefix}-${encodedKey}`;
}

function isSafeCssCustomPropertyName(input: string): boolean {
  return /^--[a-z][a-z0-9-]*(?:--[a-z][a-z0-9-]*)*$/.test(input);
}
