import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  tokenRef,
  tokenConcat,
  orThrow,
  type CompiledScheme,
  type CssModeSelectors,
  type CssVarsExport,
  type Result,
  type TokenGraph,
  type TokenLayer,
  type TokenReference,
} from "scheme-tokens";
import type * as Root from "scheme-tokens";
import type { Equal, Expect, GraphKeys, GraphModes, LayerModes } from "./type-assertions.js";

type RootModule = typeof Root;
// @ts-expect-error Result is a type, not a runtime export.
export type ResultRuntimeValue = RootModule["Result"];
// @ts-expect-error operation-specific result aliases are removed.
export type RemovedCompileResult = Root.CompileTokenGraphResult;
// @ts-expect-error old Input-suffixed graph types are removed.
export type RemovedGraphInput = Root.TokenGraphInput;
// @ts-expect-error public kind constants are removed.
export type RemovedKind = RootModule["tokenGraphKind"];
// @ts-expect-error aliases are not a public semantic lane.
export type RemovedReferenceInput = Root.ReferenceInput;
// @ts-expect-error the removed graph helper has no compatibility export.
export type RemovedGraphHelper = RootModule["defineTokens"];
// @ts-expect-error validation plumbing is not public.
export type PrivateCheck = Root.CheckToken<string, string, string>;

const concatGraph = defineTokenGraph({
  modes: ["concat"],
  defaultMode: "concat",
  tokens: {
    a: "A",
    direct: tokenConcat`prefix ${tokenRef("a")}`,
    byMode: { concat: { concat: ["prefix ", tokenRef("a")] } },
  },
});
const concatScheme = orThrow(compileTokenGraph(concatGraph));
const currentVersion: 2 = concatScheme.formatVersion;
void currentVersion;

const simpleGraph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
  },
});

const typedSimpleGraph = simpleGraph satisfies TokenGraph<"brand.600" | "primary", "base">;
typedSimpleGraph.defaultMode.toUpperCase();
export type SimpleKeys = Expect<Equal<keyof typeof simpleGraph.tokens, "brand.600" | "primary">>;
export type SimpleModes = Expect<Equal<(typeof simpleGraph.modes)[number], "base">>;
export type SimpleGraph = Expect<
  Equal<typeof simpleGraph, TokenGraph<"brand.600" | "primary", "base", "brand.600" | "primary">>
>;

const multiModeGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.400": {
      value: "#d0bcff",
      visibility: "internal",
    },
    "brand.600": "#6750a4",
    background: { light: "#ffffff", dark: "#111111" },
    primary: {
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.400"),
      },
      description: "Primary action fill",
    },
  },
});

const typedMultiModeGraph = multiModeGraph satisfies TokenGraph<
  "brand.400" | "brand.600" | "background" | "primary",
  "light" | "dark"
>;
void typedMultiModeGraph.tokens.primary?.value;
export type MultiModes = Expect<Equal<(typeof multiModeGraph.modes)[number], "light" | "dark">>;

// The static mode type is the union; authored order and the default stay runtime data.
const reorderedModes = defineTokenGraph({
  modes: ["dark", "light"],
  defaultMode: "light",
  tokens: { background: { dark: "#111", light: "#fff" } },
});
const firstMode: "light" | "dark" = reorderedModes.modes[0];
void firstMode;
// @ts-expect-error the mode union does not promise the authored position of a mode.
const falselyCallerOrderedMode: "dark" = reorderedModes.modes[0];
void falselyCallerOrderedMode;
// @ts-expect-error the default mode is not typed as the first mode either.
const falselyDefaultMode: "light" = reorderedModes.defaultMode;
void falselyDefaultMode;

// Omitted modes mean the single base mode.
const baseGraph = defineTokenGraph({ tokens: { a: "1", b: { base: "2" } } });
export type BaseModes = Expect<Equal<GraphModes<typeof baseGraph>, "base">>;

const layer = defineTokenLayer({
  id: "semantic",
  tokens: {
    primary: tokenRef("generated.source.600"),
  },
});
const typedLayer = layer satisfies TokenLayer<"primary">;
typedLayer.id.toUpperCase();
export type StandaloneLayerMode = Expect<Equal<LayerModes<typeof layer>, never>>;

const layeredGraph = defineTokenGraph({
  tokens: {
    "generated.source.600": "#6750a4",
    button: tokenRef("primary"),
  },
  layers: [layer],
});
export type LayeredKeys = Expect<
  Equal<GraphKeys<typeof layeredGraph>, "generated.source.600" | "button" | "primary">
>;
compileTokenGraph(layeredGraph, { selection: { keys: ["button", "primary"] } });

const generatedLayer = defineTokenLayer({
  id: "generated",
  tokens: {
    "generated.primary": "#6750a4",
  },
});
const overrideLayer = defineTokenLayer({
  id: "overrides",
  tokens: {
    "override.primary": "#ff0055",
  },
});
const heterogeneousLayerGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [generatedLayer, overrideLayer],
  tokens: {
    generated: tokenRef("generated.primary"),
    override: tokenRef("override.primary"),
  },
});
const heterogeneousLayerCompiled = orThrow(
  compileTokenGraph(heterogeneousLayerGraph, { selection: "all" }),
);
export type HeterogeneousLayerCompiledKeys = Expect<
  Equal<
    keyof typeof heterogeneousLayerCompiled.tokens,
    "generated.primary" | "override.primary" | "generated" | "override"
  >
>;
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [generatedLayer, overrideLayer],
  tokens: {
    // @ts-expect-error heterogeneous layer tuples retain finite typo detection.
    generated: tokenRef("generated.primari"),
  },
});

compileTokenGraph(simpleGraph, {
  selection: {
    // @ts-expect-error exact selection rejects keys outside the inferred graph union.
    keys: ["missing"],
  },
});

// Default compilation of a finite, fully known public set is complete.
const publicCompiled = orThrow(compileTokenGraph(multiModeGraph));
publicCompiled.tokens.primary.light.toUpperCase();
publicCompiled.metadataByToken.background.declarations.length.toFixed();
// @ts-expect-error internal keys are absent from the public record.
void publicCompiled.tokens["brand.400"];
const publicCss = orThrow(exportCssVars(publicCompiled));
publicCss.variableByToken.primary.toUpperCase();
// @ts-expect-error CSS lookups mirror the public record.
void publicCss.variableByToken["brand.400"];

declare const inferredModeSelectors: CssModeSelectors<"light" | "dark">;
const allCompiled = compileTokenGraph(multiModeGraph, { selection: "all" });
if (allCompiled.ok) {
  allCompiled.value.tokens["brand.400"].light.toUpperCase();
  const allCss = exportCssVars(allCompiled.value, {
    modeSelectors: {
      strategy: "selectors",
      selectors: { light: ":root", dark: ".dark" },
    },
  });
  if (allCss.ok) {
    allCss.value.variableByToken["brand.400"].toUpperCase();
  }

  exportCssVars(allCompiled.value, { modeSelectors: inferredModeSelectors });

  exportCssVars(allCompiled.value, {
    scope: { strategy: "selector", selector: "#app" },
    modeSelectors: { strategy: "class", classPrefix: "theme-" },
  });

  exportCssVars(allCompiled.value, {
    scope: { strategy: "root" },
    modeSelectors: {
      // @ts-expect-error exact selectors own the complete selector and cannot be combined with scope.
      strategy: "selectors",
      selectors: { light: ":root", dark: ".dark" },
    },
  });

  exportCssVars(allCompiled.value, {
    modeSelectors: {
      strategy: "selectors",
      // @ts-expect-error exact selector maps require every compiled mode.
      selectors: { light: ":root" },
    },
  });

  exportCssVars(allCompiled.value, {
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ":root",
        dark: ".dark",
        // @ts-expect-error exact selector maps reject unknown compiled modes.
        sepia: ".sepia",
      },
    },
  });
}

const exactCompiled = compileTokenGraph(simpleGraph, {
  selection: { keys: ["primary"] },
});
if (exactCompiled.ok) {
  const exact: CompiledScheme<"primary", "base"> = exactCompiled.value;
  exact.tokens.primary.base.toUpperCase();
  // @ts-expect-error exact selection narrows the emitted key union.
  void exactCompiled.value.tokens["brand.600"];
}

const parsed = parseTokenGraph({});
if (parsed.ok) {
  void parsed.value.kind;
  // @ts-expect-error success values never use operation-specific fields.
  void parsed.graph;

  const parsedAll = compileTokenGraph(parsed.value, { selection: "all" });
  if (parsedAll.ok) {
    // @ts-expect-error dynamically parsed graphs do not have a finite known key set.
    parsedAll.value.tokens["definitely.not.present"].base.toUpperCase();
  }
}

const parsedCompiled = parseCompiledScheme({});
if (parsedCompiled.ok) {
  // @ts-expect-error dynamically parsed compiled artifacts have unknown key presence.
  parsedCompiled.value.tokens["definitely.not.present"].base.toUpperCase();

  const parsedCss = exportCssVars(parsedCompiled.value);
  if (parsedCss.ok) {
    // @ts-expect-error CSS lookups preserve dynamic compiled-key uncertainty.
    parsedCss.value.variableByToken["definitely.not.present"].toUpperCase();
  }
}

const css = exportCssVars({} as CompiledScheme);
if (css.ok) {
  const value: CssVarsExport = css.value;
  value.css.toUpperCase();
  // @ts-expect-error CSS fields are wrapped under value.
  void css.css;
}

const reference: TokenReference<"brand.600"> = tokenRef("brand.600");
reference.ref.toUpperCase();

const result: Result<string, { code: "problem" }> = { ok: true, value: "done" };
if (result.ok) {
  result.value.toUpperCase();
}
