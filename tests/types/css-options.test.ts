// The D7 activation/D8 reference options and block shape preserve keys, modes, and completeness.
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

// Media and selector maps are partial over the finite mode union.
orThrow(
  exportCssVars(scheme, {
    activation: {
      root: ":root",
      attribute: "data-theme",
      media: { dark: "(prefers-color-scheme: dark)" },
      selectors: {
        dark: ".dark",
        dim: [{ selector: ".dim" }, { selector: "[data-contrast] .dim", media: "print" }],
      },
    },
    prefix: "app",
    cascadeLayer: "tokens",
    format: "compact",
    references: "var",
  }),
);
exportCssVars(scheme, { activation: { root: ":host" } });
exportCssVars(scheme, { references: "resolved" });
// @ts-expect-error reference projection accepts only the two documented output semantics.
exportCssVars(scheme, { references: "linked" });

const conditions = [
  { selector: ".dark" },
  { selector: ".night", media: "print" },
] as const satisfies readonly CssCondition[];
exportCssVars(scheme, { activation: { selectors: { dark: conditions } } });

const annotated: ExportCssVarsOptions<"background", Mode> = {
  activation: { media: { dim: "print" } },
};
exportCssVars(scheme, annotated);

exportCssVars(scheme, {
  activation: {
    media: {
      // @ts-expect-error media conditions reject modes the compiled scheme does not have.
      sepia: "(prefers-color-scheme: dark)",
    },
  },
});
exportCssVars(scheme, {
  activation: {
    selectors: {
      // @ts-expect-error selector conditions reject modes the compiled scheme does not have.
      sepia: ".sepia",
    },
  },
});
exportCssVars(scheme, {
  activation: {
    selectors: {
      // @ts-expect-error a condition list is non-empty.
      dark: [],
    },
  },
});
exportCssVars(scheme, {
  activation: {
    selectors: {
      // @ts-expect-error a condition names its selector.
      dark: [{ media: "print" }],
    },
  },
});
// @ts-expect-error attribute is a data-* name or false, never true.
exportCssVars(scheme, { activation: { attribute: true } });
// @ts-expect-error the removed scope option is not accepted.
exportCssVars(scheme, { scope: { strategy: "root" } });
// @ts-expect-error the removed mode-selector strategies are not accepted.
exportCssVars(scheme, { modeSelectors: { strategy: "class", classPrefix: "theme-" } });

// A dynamically parsed scheme has unknown modes, so any mode key is left to runtime validation.
const parsed = parseCompiledScheme({});
if (parsed.ok) {
  const partial = orThrow(
    exportCssVars(parsed.value, {
      activation: { media: { anything: "print" }, selectors: { other: ".x" } },
      references: "var",
    }),
  );
  const variable: string | undefined = partial.variableByToken.anything;
  // @ts-expect-error a parsed record stays incomplete even with reference projection.
  partial.variableByToken.anything.toUpperCase();
  void variable;
}

// Blocks carry structured activation metadata and keep the compiled completeness.
const exported = orThrow(exportCssVars(scheme));
const linked = orThrow(
  exportCssVars(scheme, {
    references: "var",
    variableName({ tokenKey, defaultName }) {
      const key: "background" = tokenKey;
      void key;
      return defaultName;
    },
  }),
);
const resolved = orThrow(exportCssVars(scheme, { references: "resolved" }));
export type LinkedKeepsInference = Expect<Equal<typeof linked, typeof exported>>;
export type ResolvedKeepsInference = Expect<Equal<typeof resolved, typeof exported>>;
linked.variableByToken.background.toUpperCase();
const exact = orThrow(
  compileTokenGraph(defineTokenGraph({ tokens: { a: "1px", b: "2px" } }), {
    selection: ["a"],
  }),
);
const exactExport = orThrow(exportCssVars(exact, { references: "var" }));
export type ExactKeysStayComplete = Expect<
  Equal<typeof exactExport, CssVarsExport<"a", "base", true>>
>;
exactExport.variableByToken.a.toUpperCase();
// @ts-expect-error projection does not add omitted dependencies to the key set.
void exactExport.variableByToken.b;
const runtimeKeys: readonly ("a" | "b")[] = ["a"];
const runtimeSelection = orThrow(
  compileTokenGraph(defineTokenGraph({ tokens: { a: "1px", b: "2px" } }), {
    selection: runtimeKeys,
  }),
);
const runtimeExport = orThrow(exportCssVars(runtimeSelection, { references: "var" }));
export type RuntimeKeysStayPartial = Expect<
  Equal<typeof runtimeExport, CssVarsExport<"a" | "b", "base", false>>
>;
// @ts-expect-error runtime key arrays do not prove which variables exist.
runtimeExport.variableByToken.a.toUpperCase();
type Block = (typeof exported.blocks)[number];
export type ExportKeepsCompleteness = Expect<
  Equal<typeof exported, CssVarsExport<"background", Mode, true>>
>;
export type BlockIsTyped = Expect<Equal<Block, CssVarBlock<"background", Mode>>>;
export type BlockTier = Expect<
  Equal<Block["tier"], "default" | "media" | "attribute" | "selector">
>;
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

exportCssVars(scheme, {
  activation: {
    root: ":host(.app)",
    attribute: { name: "data-mode", includeHost: true },
    selectors: { dark: { selector: ".dark", media: "print" } },
  },
});
// @ts-expect-error old top-level activation options are removed.
exportCssVars(scheme, { system: { dark: "print" } });
// @ts-expect-error omitting attribute activation replaces false.
exportCssVars(scheme, { activation: { attribute: false } });
// @ts-expect-error host inclusion belongs to attribute activation only.
exportCssVars(scheme, { activation: { root: ":host", includeHost: true } });
// @ts-expect-error includeHost is a boolean.
exportCssVars(scheme, { activation: { attribute: { name: "data-mode", includeHost: "true" } } });
// @ts-expect-error naming stays outside activation.
exportCssVars(scheme, { activation: { prefix: "app" } });
