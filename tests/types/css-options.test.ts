// The D7 activation options and block shape, checked against the compiled mode union.
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  parseCompiledScheme,
  type CssCondition,
  type CssVarBlock,
  type CssVarsExport,
  type ExportCssVarsIssue,
  type ExportCssVarsOptions,
} from "scheme-tokens";
import type * as Root from "scheme-tokens";
import type { Equal, Expect } from "./type-assertions.js";

// @ts-expect-error the scope strategy type is removed.
export type RemovedCssScope = Root.CssScope;
// @ts-expect-error the mode-selector strategy type is removed.
export type RemovedCssModeSelectors = Root.CssModeSelectors;

type Mode = "light" | "dark" | "dim";

const scheme = orThrow(
  compileTokenGraph(
    defineTokenGraph({
      modes: ["light", "dark", "dim"],
      defaultMode: "light",
      tokens: { background: { light: "#ffffff", dark: "#000000", dim: "#222222" } },
    }),
  ),
);

// System and custom maps are partial over the finite mode union.
orThrow(
  exportCssVars(scheme, {
    prefix: "app",
    root: ":root",
    attribute: "data-theme",
    system: { dark: "(prefers-color-scheme: dark)" },
    selectors: {
      dark: ".dark",
      dim: [{ selector: ".dim" }, { selector: "[data-contrast] .dim", media: "print" }],
    },
    cascadeLayer: "tokens",
    format: "compact",
  }),
);
exportCssVars(scheme, { attribute: false, root: ":host" });

const conditions = [
  { selector: ".dark" },
  { selector: ".night", media: "print" },
] as const satisfies readonly CssCondition[];
exportCssVars(scheme, { selectors: { dark: conditions } });

const annotated: ExportCssVarsOptions<"background", Mode> = { system: { dim: "print" } };
exportCssVars(scheme, annotated);

exportCssVars(scheme, {
  system: {
    // @ts-expect-error system conditions reject modes the compiled scheme does not have.
    sepia: "(prefers-color-scheme: dark)",
  },
});
exportCssVars(scheme, {
  selectors: {
    // @ts-expect-error custom conditions reject modes the compiled scheme does not have.
    sepia: ".sepia",
  },
});
exportCssVars(scheme, {
  selectors: {
    // @ts-expect-error a condition list is non-empty.
    dark: [],
  },
});
exportCssVars(scheme, {
  selectors: {
    // @ts-expect-error a condition names its selector.
    dark: [{ media: "print" }],
  },
});
// @ts-expect-error attribute is a data-* name or false, never true.
exportCssVars(scheme, { attribute: true });
// @ts-expect-error the removed scope option is not accepted.
exportCssVars(scheme, { scope: { strategy: "root" } });
// @ts-expect-error the removed mode-selector strategies are not accepted.
exportCssVars(scheme, { modeSelectors: { strategy: "class", classPrefix: "theme-" } });

// A dynamically parsed scheme has unknown modes, so any mode key is left to runtime validation.
const parsed = parseCompiledScheme({});
if (parsed.ok) {
  exportCssVars(parsed.value, { system: { anything: "print" }, selectors: { other: ".x" } });
}

// Blocks carry structured activation metadata and keep the compiled completeness.
const exported = orThrow(exportCssVars(scheme));
type Block = (typeof exported.blocks)[number];
export type ExportKeepsCompleteness = Expect<
  Equal<typeof exported, CssVarsExport<"background", Mode, true>>
>;
export type BlockIsTyped = Expect<Equal<Block, CssVarBlock<"background", Mode>>>;
export type BlockTier = Expect<Equal<Block["tier"], "base" | "system" | "explicit" | "custom">>;
export type BlockSelectors = Expect<Equal<Block["selectors"], readonly [string, ...string[]]>>;
export type BlockMedia = Expect<Equal<Block["media"], string | undefined>>;
for (const block of exported.blocks) {
  const selector: string = block.selectors[0];
  const mode: Mode = block.mode;
  void selector;
  void mode;
}
exported.variableByToken.background.toUpperCase();

// The removed selector strategies left no issue codes behind.
export type NoRemovedIssueCodes = Expect<
  Equal<
    Extract<
      ExportCssVarsIssue["code"],
      | "invalid-scope"
      | "invalid-data-attribute"
      | "invalid-class-prefix"
      | "invalid-mode-selectors"
      | "missing-mode-selector"
      | "unknown-mode-selector"
      | "duplicate-mode-selector"
    >,
    never
  >
>;
