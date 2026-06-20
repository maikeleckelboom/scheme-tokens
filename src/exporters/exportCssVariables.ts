import type { CompiledTokenSet } from "../core/compiled-types";
import { isClassPrefix, isDataAttributeName, isSingleSegmentIdentifier } from "../core/identifiers";
import { compareCodeUnits, readPlainRecord } from "../core/json";
import type { Issue, Result } from "../core/result";
import { formatCssColor } from "./formatCssColor";
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

export interface ExportCssVariablesOptions {
  readonly variablePrefix?: string;
  readonly scope?: CssScope;
  readonly modeSelectors?: CssModeSelectors;
  readonly format?: "pretty" | "compact";
}

export type ExportCssVariablesIssue = Issue<
  | "invalid-css-options"
  | "invalid-variable-prefix"
  | "invalid-scope"
  | "invalid-selector"
  | "invalid-data-attribute"
  | "invalid-class-prefix"
  | "invalid-mode-selectors"
  | "missing-mode-selector"
  | "unknown-mode-selector"
  | "duplicate-mode-selector"
> & {
  readonly mode?: string;
  readonly selector?: string;
};

export function exportCssVariables(
  tokenSet: CompiledTokenSet,
  options?: ExportCssVariablesOptions,
): Result<string, ExportCssVariablesIssue> {
  const parsed = parseOptions(tokenSet, options);
  if (!parsed.ok) return parsed;

  const tokenKeys = Object.keys(tokenSet.tokens).sort(compareCodeUnits);
  const blocks = tokenSet.modes.map((mode) => {
    const declarations = tokenKeys.map((key) => {
      const value = tokenSet.tokens[key]?.valueByMode[mode];
      return `${cssVariableName(key, parsed.value.variablePrefix)}:${parsed.value.compact ? "" : " "}${formatCssColor(value as never)};`;
    });
    return parsed.value.compact
      ? `${parsed.value.selectors[mode]}{${declarations.join("")}}`
      : [
          `${parsed.value.selectors[mode]} {`,
          ...declarations.map((declaration) => `  ${declaration}`),
          "}",
        ].join("\n");
  });

  return {
    ok: true,
    value: parsed.value.compact ? blocks.join("") : `${blocks.join("\n\n")}\n`,
  };
}

interface ParsedCssOptions {
  readonly variablePrefix?: string;
  readonly selectors: Readonly<Record<string, string>>;
  readonly compact: boolean;
}

function parseOptions(
  tokenSet: CompiledTokenSet,
  options: ExportCssVariablesOptions | undefined,
): Result<ParsedCssOptions, ExportCssVariablesIssue> {
  const entries =
    options === undefined
      ? ({ ok: true, value: [] } as const)
      : readPlainRecord(options, {
          code: "invalid-css-options",
          message: "CSS options must be a plain object.",
        });
  if (!entries.ok) return entries as Result<never, ExportCssVariablesIssue>;

  for (const entry of entries.value) {
    if (
      entry.key !== "variablePrefix" &&
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
  const variablePrefix = record.get("variablePrefix");
  if (
    variablePrefix !== undefined &&
    (typeof variablePrefix !== "string" || !isSingleSegmentIdentifier(variablePrefix))
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-variable-prefix",
          message: "variablePrefix must be a lower-kebab single segment.",
        },
      ],
    };
  }
  const format = record.get("format") ?? "pretty";
  if (format !== "pretty" && format !== "compact") {
    return {
      ok: false,
      issues: [{ code: "invalid-css-options", message: "format must be pretty or compact." }],
    };
  }

  const modeSelectors = record.get("modeSelectors");
  const scope = record.get("scope");
  const selectors = parseSelectors(tokenSet, scope, modeSelectors);
  if (!selectors.ok) return selectors;

  return {
    ok: true,
    value: {
      ...(typeof variablePrefix === "string" ? { variablePrefix } : {}),
      selectors: selectors.value,
      compact: format === "compact",
    },
  };
}

function parseSelectors(
  tokenSet: CompiledTokenSet,
  scopeInput: unknown,
  modeSelectorsInput: unknown,
): Result<Readonly<Record<string, string>>, ExportCssVariablesIssue> {
  const modeSelector = modeSelectorsInput ?? {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  };
  const selectorStrategy = readPlainRecord(modeSelector, {
    code: "invalid-mode-selectors",
    message: "modeSelectors must be a plain object.",
  });
  if (!selectorStrategy.ok) return selectorStrategy as Result<never, ExportCssVariablesIssue>;
  const strategyRecord = new Map(selectorStrategy.value.map((entry) => [entry.key, entry.value]));
  const strategy = strategyRecord.get("strategy");

  if (strategy === "selectors") {
    if (scopeInput !== undefined) {
      return {
        ok: false,
        issues: [{ code: "invalid-scope", message: "scope must be omitted with exact selectors." }],
      };
    }
    return parseExactSelectors(tokenSet, strategyRecord.get("selectors"));
  }

  const scope = parseScope(scopeInput);
  if (!scope.ok) return scope;

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
      tokenSet,
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
      tokenSet,
      (mode) => `${scope.value}.${classPrefix}${mode}`,
      scope.value,
    );
  }

  return {
    ok: false,
    issues: [{ code: "invalid-mode-selectors", message: "Unsupported mode selector strategy." }],
  };
}

function parseScope(input: unknown): Result<string, ExportCssVariablesIssue> {
  if (input === undefined) return { ok: true, value: ":root" };
  const entries = readPlainRecord(input, {
    code: "invalid-scope",
    message: "scope must be a plain object.",
  });
  if (!entries.ok) return entries as Result<never, ExportCssVariablesIssue>;
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (record.get("strategy") === "root" && record.size === 1) return { ok: true, value: ":root" };
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
  tokenSet: CompiledTokenSet,
  input: unknown,
): Result<Readonly<Record<string, string>>, ExportCssVariablesIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-mode-selectors",
    message: "selectors must be a plain object.",
  });
  if (!entries.ok) return entries as Result<never, ExportCssVariablesIssue>;

  const modeSet = new Set(tokenSet.modes);
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
            selector: String(entry.value),
          },
        ],
      };
    }
    selectors[entry.key] = entry.value;
  }
  for (const mode of tokenSet.modes) {
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
  tokenSet: CompiledTokenSet,
  selectorForMode: (mode: string) => string,
  defaultSelector: string,
): Result<Readonly<Record<string, string>>, ExportCssVariablesIssue> {
  const selectors: Record<string, string> = {};
  for (const mode of tokenSet.modes) {
    selectors[mode] = mode === tokenSet.defaultMode ? defaultSelector : selectorForMode(mode);
  }
  return rejectDuplicateSelectors(selectors);
}

function rejectDuplicateSelectors(
  selectors: Readonly<Record<string, string>>,
): Result<Readonly<Record<string, string>>, ExportCssVariablesIssue> {
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

function cssVariableName(key: string, prefix: string | undefined): string {
  return `--${[...(prefix === undefined ? [] : [prefix]), ...key.split(".")].join("--")}`;
}
