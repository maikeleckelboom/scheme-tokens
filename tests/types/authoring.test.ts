import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  tokenRef,
  type CompiledScheme,
  type CssVarsExport,
  type Result,
  type TokenGraph,
  type TokenLayer,
  type TokenReference,
} from "../../src";
import type * as Root from "../../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

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

const simpleGraph = defineTokens({
  "brand.600": "#6750a4",
  primary: tokenRef("brand.600"),
});

const typedSimpleGraph = simpleGraph satisfies TokenGraph<"brand.600" | "primary", "base">;
typedSimpleGraph.defaultMode.toUpperCase();
export type SimpleKeys = Expect<Equal<keyof typeof simpleGraph.tokens, "brand.600" | "primary">>;
export type SimpleModes = Expect<Equal<(typeof simpleGraph.modes)[number], "base">>;

defineTokens({
  background: "#ffffff",
  // @ts-expect-error finite literal records reject unknown reference targets.
  primary: tokenRef("missing.600"),
});

// @ts-expect-error a mode map requires an explicit modes/defaultMode envelope.
defineTokens({ background: { light: "#fff", dark: "#000" } });

const multiModeGraph = defineTokens(
  {
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
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

const typedMultiModeGraph = multiModeGraph satisfies TokenGraph<
  "brand.400" | "brand.600" | "background" | "primary",
  "light" | "dark"
>;
void typedMultiModeGraph.tokens.primary.value;
export type MultiModes = Expect<Equal<(typeof multiModeGraph.modes)[number], "light" | "dark">>;

const reorderedModes = defineTokens(
  { background: { dark: "#111", light: "#fff" } },
  { modes: ["dark", "light"], defaultMode: "light" },
);
const canonicalFirstMode: "light" | "dark" = reorderedModes.modes[0];
void canonicalFirstMode;
// @ts-expect-error runtime canonicalization does not preserve the caller's tuple positions.
const falselyCallerOrderedMode: "dark" = reorderedModes.modes[0];
void falselyCallerOrderedMode;

// @ts-expect-error every declared mode is required in a mode map.
defineTokens(
  {
    background: { light: "#fff" },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);

// @ts-expect-error undeclared mode keys are rejected.
defineTokens(
  {
    background: {
      light: "#fff",
      dark: "#000",
      sepia: "#eee",
    },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);

// @ts-expect-error defaultMode must belong to the declared mode tuple.
defineTokens(
  { background: { light: "#fff", dark: "#000" } },
  {
    modes: ["light", "dark"],
    defaultMode: "sepia",
  },
);

defineTokens(
  { background: "#fff" },
  {
    // @ts-expect-error token-object control names are reserved as mode names.
    modes: ["light", "value"],
    defaultMode: "light",
  },
);

defineTokenGraph({
  tokens: {
    // @ts-expect-error valueByMode is not accepted by trusted authoring.
    background: { valueByMode: { light: "#fff", dark: "#000" } },
  },
  modes: ["light", "dark"],
  defaultMode: "light",
});

defineTokenGraph({
  tokens: { "brand.600": "#6750a4" },
  // @ts-expect-error aliases were removed in favor of tokenRef().
  aliases: { primary: "brand.600" },
});

const layer = defineTokenLayer({
  id: "semantic",
  tokens: {
    primary: tokenRef("generated.source.600"),
  },
});
const typedLayer = layer satisfies TokenLayer<"primary">;
typedLayer.id.toUpperCase();

const layeredGraph = defineTokenGraph({
  tokens: {
    "generated.source.600": "#6750a4",
    button: tokenRef("primary"),
  },
  layers: [layer],
});
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
const heterogeneousLayerCompiled = compileTokenGraph(heterogeneousLayerGraph, {
  selection: "all",
});
if (heterogeneousLayerCompiled.ok) {
  type HeterogeneousLayerCompiledKeys = Expect<
    Equal<
      keyof typeof heterogeneousLayerCompiled.value.tokens,
      "generated.primary" | "override.primary" | "generated" | "override"
    >
  >;
  const heterogeneousLayerCompiledKeys: HeterogeneousLayerCompiledKeys = true;
  void heterogeneousLayerCompiledKeys;
}
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

const publicCompiled = compileTokenGraph(multiModeGraph);
if (publicCompiled.ok) {
  const possiblyFiltered = publicCompiled.value.tokens["brand.400"];
  void possiblyFiltered;
  // @ts-expect-error default public selection may omit a graph key.
  publicCompiled.value.tokens["brand.400"].light.toUpperCase();

  const publicCss = exportCssVars(publicCompiled.value);
  if (publicCss.ok) {
    // @ts-expect-error CSS lookup mirrors the possibly filtered public token set.
    publicCss.value.variableByToken["brand.400"].toUpperCase();
  }
}

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

const dynamicSelectionKeys: Array<keyof typeof simpleGraph.tokens> = ["primary"];
const dynamicSelection = compileTokenGraph(simpleGraph, {
  selection: { keys: dynamicSelectionKeys },
});
if (dynamicSelection.ok) {
  // @ts-expect-error a runtime array may omit any member of its key union.
  dynamicSelection.value.tokens["brand.600"].base.toUpperCase();
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

  const parsedExact = compileTokenGraph(parsed.value, {
    selection: { keys: ["runtime-validated.key"] },
  });
  if (parsedExact.ok) {
    const exactToken: Readonly<Record<string, string>> =
      parsedExact.value.tokens["runtime-validated.key"];
    void exactToken;
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
