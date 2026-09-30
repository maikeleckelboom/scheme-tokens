import type { CompiledExpression, CompiledScheme } from "../core/compiled-types";
import { compareCodeUnits, pointer } from "../core/json";
import { parseCompiledScheme } from "../core/parse-compiled-scheme";
import { IssueCollector, type Result } from "../core/result";
import { describeUnknown } from "../core/unknown-description";
import { parseCssOptions, type ParsedCssOptions } from "./css-options";
import type {
  CssActivationTier,
  CssVarBlock,
  CssVarDeclaration,
  CssVarsExport,
  ExportCssVarsIssue,
  ExportCssVarsOptions,
} from "./css-types";
import { isSafeCssDeclarationValue } from "./selector-validation";

type AnyCompiledScheme = CompiledScheme<string, string, boolean>;
type SchemeKey<Scheme extends AnyCompiledScheme> = Extract<keyof Scheme["tokens"], string>;
type SchemeMode<Scheme extends AnyCompiledScheme> = Extract<Scheme["modes"][number], string>;
type SchemeCompleteness<Scheme extends AnyCompiledScheme> =
  Scheme extends CompiledScheme<string, string, infer Complete> ? Complete : boolean;

type ExportCssVarsOptionsFor<Scheme extends AnyCompiledScheme> = ExportCssVarsOptions<
  SchemeKey<Scheme>,
  SchemeMode<Scheme>
>;

type ExportedCssVars<Scheme extends AnyCompiledScheme> = Result<
  CssVarsExport<SchemeKey<Scheme>, SchemeMode<Scheme>, SchemeCompleteness<Scheme>>,
  ExportCssVarsIssue
>;

/**
 * Export a compiled scheme as deterministic CSS custom properties. Blocks follow the tier order
 * base, system, explicit, custom; within a tier, the scheme's authored mode order; within one
 * mode, the order of its conditions. Every activation selector is wrapped in `:where()`, so the
 * later matching block wins and application CSS competes through the ordinary cascade.
 * Resolved values are the default; `references: "var"` links retained direct references only
 * to targets in this scheme's emitted key set. Every block redeclares every token, including
 * aliases, so target overrides at activation elements propagate through the local references.
 */
export function exportCssVars<const Scheme extends AnyCompiledScheme>(
  scheme: Scheme,
  options?: ExportCssVarsOptionsFor<Scheme>,
): ExportedCssVars<Scheme>;
export function exportCssVars(
  scheme: AnyCompiledScheme,
  options?: ExportCssVarsOptions,
): Result<CssVarsExport<string, string, boolean>, ExportCssVarsIssue> {
  const parsedScheme = parseCompiledScheme(scheme);
  if (!parsedScheme.ok) {
    return parsedScheme;
  }
  const compiled = parsedScheme.value;

  const parsedOptions = parseCssOptions(compiled, options);
  if (!parsedOptions.ok) {
    return parsedOptions;
  }

  const activations = planActivations(compiled, parsedOptions.value);
  const tokenKeys = Object.keys(compiled.tokens).sort(compareCodeUnits);
  const emittedModes = compiled.modes.filter((mode) =>
    activations.some((activation) => activation.mode === mode),
  );

  // Build names once. Naming issues must not hide independently unsafe projected values.
  const collector = new IssueCollector<ExportCssVarsIssue>();
  const variableByToken = buildVariableNames(tokenKeys, parsedOptions.value, collector);
  const declarationsByMode = projectDeclarations(
    compiled,
    tokenKeys,
    emittedModes,
    variableByToken,
    parsedOptions.value,
    collector,
  );
  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }

  const blocks: CssVarBlock[] = activations.map((activation) => ({
    tier: activation.tier,
    mode: activation.mode,
    selectors: activation.selectors,
    ...(activation.media === undefined ? {} : { media: activation.media }),
    declarations: declarationsByMode.get(activation.mode) ?? [],
  }));

  return {
    ok: true,
    value: {
      css: formatCss(blocks, parsedOptions.value),
      blocks,
      variableByToken,
    },
  };
}

interface Activation {
  readonly tier: CssActivationTier;
  readonly mode: string;
  readonly selectors: readonly [string, ...string[]];
  readonly media?: string;
}

function planActivations(scheme: AnyCompiledScheme, options: ParsedCssOptions): Activation[] {
  const root: readonly [string] = [options.root];
  const activations: Activation[] = [{ tier: "base", mode: scheme.defaultMode, selectors: root }];

  for (const mode of scheme.modes) {
    const media = options.system.get(mode);
    if (media !== undefined) {
      activations.push({ tier: "system", mode, selectors: root, media });
    }
  }

  const attribute = options.attribute;
  if (attribute !== undefined) {
    for (const mode of scheme.modes) {
      activations.push({
        tier: "explicit",
        mode,
        selectors: explicitSelectors(options.root, attribute, mode),
      });
    }
  }

  for (const mode of scheme.modes) {
    for (const condition of options.selectors.get(mode) ?? []) {
      activations.push({
        tier: "custom",
        mode,
        selectors: [condition.selector],
        ...(condition.media === undefined ? {} : { media: condition.media }),
      });
    }
  }

  return activations;
}

// A marker is unanchored so any element can switch modes. Inside a shadow tree the host is not
// matched by an ordinary selector, so a `:host` root also gets the host form of the marker.
function explicitSelectors(
  root: string,
  attribute: string,
  mode: string,
): readonly [string, ...string[]] {
  const marker = `[${attribute}="${mode}"]`;
  return root === ":host" ? [`:host(${marker})`, marker] : [marker];
}

function buildVariableNames(
  tokenKeys: readonly string[],
  options: ParsedCssOptions,
  collector: IssueCollector<ExportCssVarsIssue>,
): Record<string, string> {
  const variables: Record<string, string> = {};
  const firstKeyByProperty = new Map<string, string>();
  for (const key of tokenKeys) {
    const property = variableNameFor(key, options, collector);
    if (property === undefined) {
      continue;
    }
    const firstKey = firstKeyByProperty.get(property);
    if (firstKey !== undefined) {
      collector.add({
        code: "duplicate-css-variable",
        message: `Tokens ${JSON.stringify(firstKey)} and ${JSON.stringify(key)} both map to the CSS variable ${property}.`,
        key,
        firstKey,
        property,
      });
      continue;
    }
    firstKeyByProperty.set(property, key);
    variables[key] = property;
  }
  return variables;
}

function variableNameFor(
  key: string,
  options: ParsedCssOptions,
  collector: IssueCollector<ExportCssVarsIssue>,
): string | undefined {
  const segments = key.split(".") as [string, ...string[]];
  const defaultName = `--${options.prefix === undefined ? "" : `${options.prefix}-`}${segments.join("-")}`;
  if (options.variableName === undefined) {
    return defaultName;
  }

  let property: unknown;
  try {
    property = options.variableName({
      tokenKey: key,
      segments,
      defaultName,
      ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
    });
  } catch {
    collector.add({
      code: "invalid-css-variable",
      message: `variableName threw for token ${JSON.stringify(key)}.`,
      key,
    });
    return undefined;
  }
  if (typeof property === "string" && isSafeCssCustomPropertyName(property)) {
    return property;
  }
  collector.add({
    code: "invalid-css-variable",
    message: `variableName must return a safe CSS custom property name for token ${JSON.stringify(key)}, received ${describeUnknown(property)}.`,
    key,
    ...(typeof property === "string" ? { property } : {}),
  });
  return undefined;
}

// This safe name is used only while collecting diagnostics after a naming failure. It cannot
// be returned: every absent name already has an issue, and the caller checks issues before
// constructing blocks or formatting CSS. Selection membership is always checked separately.
const FAILED_VARIABLE_NAME = "--scheme-tokens-invalid-name";

function nameForDiagnostics(
  key: string,
  variableByToken: Readonly<Record<string, string>>,
): string {
  return Object.hasOwn(variableByToken, key)
    ? (variableByToken[key] as string)
    : FAILED_VARIABLE_NAME;
}

// Project and check each emitted key/mode once, however many activation blocks declare it.
function projectDeclarations(
  scheme: AnyCompiledScheme,
  tokenKeys: readonly string[],
  modes: readonly string[],
  variableByToken: Readonly<Record<string, string>>,
  options: ParsedCssOptions,
  collector: IssueCollector<ExportCssVarsIssue>,
): ReadonlyMap<string, readonly CssVarDeclaration[]> {
  const emittedKeys = new Set(tokenKeys);
  const declarationsByMode = new Map<string, CssVarDeclaration[]>(modes.map((mode) => [mode, []]));
  for (const key of tokenKeys) {
    for (const mode of modes) {
      const tokenPath = pointer("tokens", key, mode);
      const resolved = scheme.tokens[key]?.[mode];
      if (resolved === undefined) {
        collector.add({
          code: "invalid-object",
          message: "Compiled scheme is missing a parsed token value.",
          path: tokenPath,
        });
        continue;
      }
      const expressions = scheme.metadataByToken[key]?.expressionByMode;
      const expression =
        options.references === "var" &&
        expressions !== undefined &&
        Object.hasOwn(expressions, mode)
          ? expressions[mode]
          : undefined;
      const value = projectValue(resolved, expression, emittedKeys, variableByToken);
      if (!isSafeCssDeclarationValue(value)) {
        collector.add({
          code: "invalid-css-value",
          message: "Compiled token value is not safe in a CSS declaration.",
          path:
            expression !== undefined && "concat" in expression
              ? pointer("metadataByToken", key, "expressionByMode", mode)
              : tokenPath,
          key,
          mode,
        });
      }
      declarationsByMode.get(mode)?.push({
        tokenKey: key,
        property: nameForDiagnostics(key, variableByToken),
        value,
      });
    }
  }
  return declarationsByMode;
}

function projectValue(
  resolved: string,
  expression: CompiledExpression | undefined,
  emittedKeys: ReadonlySet<string>,
  variableByToken: Readonly<Record<string, string>>,
): string {
  if (expression === undefined) {
    return resolved;
  }
  if ("ref" in expression) {
    return emittedKeys.has(expression.ref)
      ? `var(${nameForDiagnostics(expression.ref, variableByToken)})`
      : resolved;
  }
  return expression.concat
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      return emittedKeys.has(part.ref)
        ? `var(${nameForDiagnostics(part.ref, variableByToken)})`
        : part.value;
    })
    .join("");
}

function formatCss(blocks: readonly CssVarBlock[], options: ParsedCssOptions): string {
  const layer = options.cascadeLayer;
  if (options.compact) {
    const body = blocks.map(formatCompactBlock).join("");
    return layer === undefined ? body : `@layer ${layer}{${body}}`;
  }

  const depth = layer === undefined ? 0 : 1;
  const body = blocks.map((block) => formatPrettyBlock(block, depth).join("\n")).join("\n\n");
  return layer === undefined ? `${body}\n` : `@layer ${layer} {\n${body}\n}\n`;
}

function formatCompactBlock(block: CssVarBlock): string {
  const declarations = block.declarations
    .map((declaration) => `${declaration.property}:${declaration.value};`)
    .join("");
  const rule = `:where(${block.selectors.join(",")}){${declarations}}`;
  return block.media === undefined ? rule : `@media ${block.media}{${rule}}`;
}

function formatPrettyBlock(block: CssVarBlock, depth: number): readonly string[] {
  const ruleDepth = block.media === undefined ? depth : depth + 1;
  const rule = [
    `${indent(ruleDepth)}:where(${block.selectors.join(", ")}) {`,
    ...block.declarations.map(
      (declaration) => `${indent(ruleDepth + 1)}${declaration.property}: ${declaration.value};`,
    ),
    `${indent(ruleDepth)}}`,
  ];
  return block.media === undefined
    ? rule
    : [`${indent(depth)}@media ${block.media} {`, ...rule, `${indent(depth)}}`];
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

// Equivalent to the former `^--[a-z][a-z0-9-]*(?:--[a-z0-9][a-z0-9-]*)*$`, without the nested
// quantifier that could backtrack on a hostile callback result.
function isSafeCssCustomPropertyName(input: string): boolean {
  return /^--[a-z][a-z0-9-]*$/.test(input);
}
