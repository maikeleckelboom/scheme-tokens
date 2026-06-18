import type { CompiledTokenSet } from "../core/compileGraph";
import type { ModeKey } from "../core/modes";
import { formatCssColor } from "./formatCssColor";

export interface CssVariableModeSelectors {
  readonly [mode: string]: string;
}

export interface CssVariableOptions {
  readonly selector?: string;
  readonly prefix?: string;
  readonly modeSelectors?: CssVariableModeSelectors;
  readonly minify?: boolean;
}

export function exportCssVariables(
  tokenSet: CompiledTokenSet,
  options: CssVariableOptions = {},
): string {
  const selector = options.selector ?? ":root";
  const sortedTokens = [...tokenSet.tokens].sort((left, right) =>
    String(left.key).localeCompare(String(right.key)),
  );
  const blocks = tokenSet.modes.map((mode, index) => {
    const declarations = sortedTokens.flatMap((token) => {
      const value = token.values.find((entry) => entry.mode === mode)?.value;
      if (value === undefined) return [];
      return [`${toCssVariableName(String(token.key), options.prefix)}: ${formatCssColor(value)};`];
    });

    return formatBlock(resolveModeSelector(mode, index, selector, options), declarations, options);
  });

  return options.minify ? blocks.join("") : `${blocks.join("\n\n")}\n`;
}

function resolveModeSelector(
  mode: ModeKey,
  index: number,
  selector: string,
  options: CssVariableOptions,
): string {
  const override = options.modeSelectors?.[String(mode)];
  if (override !== undefined) return override;
  if (index === 0) return selector;
  return `${selector}[data-color-scheme="${String(mode)}"]`;
}

function formatBlock(
  selector: string,
  declarations: readonly string[],
  options: CssVariableOptions,
): string {
  if (options.minify) {
    return `${selector}{${declarations.join("")}}`;
  }

  return [`${selector} {`, ...declarations.map((declaration) => `  ${declaration}`), "}"].join(
    "\n",
  );
}

function toCssVariableName(key: string, prefix: string | undefined): `--${string}` {
  const normalizedPrefix = prefix === undefined ? [] : splitWords(prefix);
  const parts = [...normalizedPrefix, ...key.split(".").flatMap(splitWords)];
  return `--${parts.join("-").toLowerCase()}`;
}

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\s.]+/g, " ")
    .replace(/[^a-zA-Z0-9-]+/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}
