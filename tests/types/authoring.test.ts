import {
  buildScheme,
  compileTokenGraph,
  createSchemeBuilder,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  tokenRef,
  type BuildSchemeSourceOptions,
  type CssVarBlock,
  type CssVarsExport,
  type ExportCssVarsOptions,
  type Issue,
  type Result,
  type SchemeBuilder,
  type SchemeBuilderConfig,
  type ColorTokenGraphInput,
  type ColorTokenLayerInput,
  type ColorTokenSource,
  type ModeOf,
  type TokenKeyOf,
} from "../../src";
import type * as Root from "../../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type RootModule = typeof Root;
type RemovedLayerHelperName = `defineToken${"Frag"}${"ment"}`;
// @ts-expect-error old token layer helper is not exported.
export type RemovedLayerHelper = RootModule[RemovedLayerHelperName];
type RemovedBuildName = `build${"Token"}${"Set"}`;
// @ts-expect-error old build helper is not exported.
export type RemovedBuildHelper = RootModule[RemovedBuildName];
type RemovedCompiledName = `Compiled${"Token"}${"Set"}`;
// @ts-expect-error old compiled type is not exported.
export type RemovedCompiledType = RootModule[RemovedCompiledName];
// @ts-expect-error root no longer exports CSS color parsing.
export type RemovedParseColor = RootModule["parseColor"];
// @ts-expect-error root no longer exports CSS color formatting.
export type RemovedFormatCssColor = RootModule["formatCssColor"];
// @ts-expect-error structured color values are not part of the root public API.
export type RemovedColorValue = Root.ColorValue;
// @ts-expect-error structured color authoring input is not part of the root public API.
export type RemovedColorValueInput = Root.ColorValueInput;

const simpleGraph = defineTokenGraph({
  tokens: {
    "app.background": "#ffffff",
    "app.foreground": tokenRef("app.background"),
  },
});

const typedSimpleGraph = simpleGraph satisfies ColorTokenGraphInput<"base">;
typedSimpleGraph.defaultMode.toUpperCase();
export type SimpleGraphKeys = Expect<
  Equal<TokenKeyOf<typeof simpleGraph>, "app.background" | "app.foreground">
>;
export type SimpleGraphModes = Expect<Equal<ModeOf<typeof simpleGraph>, "base">>;

const simpleTokensGraph = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": tokenRef("app.background"),
});
const typedSimpleTokensGraph = simpleTokensGraph satisfies ColorTokenGraphInput<"base">;
typedSimpleTokensGraph.defaultMode.toUpperCase();

const aliasGraph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  aliases: {
    primary: "brand.primary",
  },
});
export type AliasGraphKeys = Expect<
  Equal<TokenKeyOf<typeof aliasGraph>, "brand.primary" | "primary">
>;

const multiModeTokensGraph = defineTokens(
  {
    "app.background": {
      light: "#ffffff",
      dark: "#141218",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
const typedMultiModeTokensGraph = multiModeTokensGraph satisfies ColorTokenGraphInput<
  "light" | "dark"
>;
typedMultiModeTokensGraph.defaultMode.toUpperCase();

defineTokens(
  { background: "#ffffff" },
  {
    // @ts-expect-error defineTokens options cannot include tokens.
    tokens: {},
  },
);

const source: ColorTokenSource = {
  id: "brand",
  build(): Result<ColorTokenGraphInput, Issue> {
    return { ok: true, value: simpleGraph };
  },
};

const built = buildScheme({ base: [source] });
if (built.ok) {
  built.value.defaultMode.toUpperCase();
  // @ts-expect-error buildScheme returns compiled, not scheme.
  built.value["scheme"].defaultMode.toUpperCase();
}

const sourceBuilt = buildScheme(source);
if (sourceBuilt.ok) {
  sourceBuilt.value.defaultMode.toUpperCase();
}

const sourceOptions: BuildSchemeSourceOptions = { selection: "all" };
const sourceOptionsBuilt = buildScheme(source, sourceOptions);
if (sourceOptionsBuilt.ok) {
  sourceOptionsBuilt.value.defaultMode.toUpperCase();
}

const sourceArrayBuilt = buildScheme([source, source]);
if (sourceArrayBuilt.ok) {
  sourceArrayBuilt.value.defaultMode.toUpperCase();
}

// @ts-expect-error source is not a buildScheme option.
buildScheme({ source });

// @ts-expect-error source shorthand options cannot include base.
buildScheme(source, { base: [source] });

const emptyBuild = buildScheme({});
if (!emptyBuild.ok) {
  emptyBuild.issues[0]?.code.toUpperCase();
}

const emptyContributorBuild = buildScheme({ base: [], layers: [] });
if (!emptyContributorBuild.ok) {
  emptyContributorBuild.issues[0]?.code.toUpperCase();
}

const oldContributorOption = `frag${"ments"}`;
// @ts-expect-error old contributor option is not accepted.
buildScheme({ [oldContributorOption]: [] });

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "app.background": {
      light: "#ffffff",
      dark: "#111111",
    },
  },
});

const typedGraph = graph satisfies ColorTokenGraphInput<"light" | "dark">;
typedGraph.defaultMode.toUpperCase();
export type MultiModeGraphKeys = Expect<Equal<TokenKeyOf<typeof graph>, "app.background">>;
export type MultiModeGraphModes = Expect<Equal<ModeOf<typeof graph>, "light" | "dark">>;

const compiledGraph = compileTokenGraph(graph);
if (compiledGraph.ok) {
  const tokenKey: TokenKeyOf<typeof compiledGraph.value> = "app.background";
  const mode: ModeOf<typeof compiledGraph.value> = "light";
  tokenKey.toUpperCase();
  mode.toUpperCase();
  // @ts-expect-error misspelled token key is not part of the compiled literal key union.
  const misspelledTokenKey: TokenKeyOf<typeof compiledGraph.value> = "app.backgrond";
  misspelledTokenKey.toUpperCase();
}

const layer = defineTokenLayer({
  id: "brand",
  tokens: {
    "brand.primary": "#6750a4",
    "brand.on-primary": tokenRef("brand.primary"),
  },
  aliases: {
    primary: "brand.primary",
  },
});
const typedLayer = layer satisfies ColorTokenLayerInput;
typedLayer.id.toUpperCase();

const graphWithLayer = defineTokenGraph({
  tokens: {
    "app.background": "#ffffff",
  },
  layers: [layer],
});
export type GraphWithLayerKeys = Expect<
  Equal<
    TokenKeyOf<typeof graphWithLayer>,
    "app.background" | "brand.primary" | "brand.on-primary" | "primary"
  >
>;

const applicationLayer = defineTokenLayer<"light" | "dark">({
  id: "application",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.primary": "material3.primary",
    "app.primary-foreground": "material3.on-primary",
  },
});
const typedApplicationLayer = applicationLayer satisfies ColorTokenLayerInput<"light" | "dark">;
typedApplicationLayer.defaultVisibility.toUpperCase();
export type ApplicationAliasKeys = Expect<
  Equal<Extract<"app.background", keyof typeof applicationLayer.tokens>, "app.background">
>;

const sourceAndLayerBuilt = buildScheme(source, { layers: [layer], selection: "all" });
if (sourceAndLayerBuilt.ok) {
  sourceAndLayerBuilt.value.defaultMode.toUpperCase();
}

const builderConfig: SchemeBuilderConfig = { layers: [layer], selection: "all" };
const builder: SchemeBuilder = createSchemeBuilder(builderConfig);
const builderSourceBuilt = builder.build(source);
if (builderSourceBuilt.ok) {
  builderSourceBuilt.value.defaultMode.toUpperCase();
}
const builderObjectBuilt = builder.build({ base: source });
if (builderObjectBuilt.ok) {
  builderObjectBuilt.value.defaultMode.toUpperCase();
}
const builderLayerBuilt = builder.build();
if (builderLayerBuilt.ok) {
  builderLayerBuilt.value.defaultMode.toUpperCase();
}

// @ts-expect-error source is not a createSchemeBuilder config option.
createSchemeBuilder({ source });

// @ts-expect-error base is supplied to builder.build, not createSchemeBuilder.
createSchemeBuilder({ base: source });

// @ts-expect-error source is not a scheme builder build input property.
builder.build({ source });

// @ts-expect-error sourceColors is Material-specific and belongs inside material3().
builder.build({ sourceColors: "#6750a4" });

// @ts-expect-error variant is Material-specific and belongs inside material3().
builder.build({ variant: "expressive" });

const sourceArrayAndLayerBuilt = buildScheme([source, source], {
  layers: [layer],
  selection: "all",
});
if (sourceArrayAndLayerBuilt.ok) {
  sourceArrayAndLayerBuilt.value.defaultMode.toUpperCase();
}

// @ts-expect-error layers are not positional buildScheme contributors.
buildScheme(layer);

// @ts-expect-error layer arrays are not positional buildScheme contributors.
buildScheme([layer, layer]);

// @ts-expect-error mixed positional source/layer arrays are not supported.
buildScheme([source, layer]);

const layerBuilt = buildScheme({ layers: [layer] });
if (layerBuilt.ok) {
  layerBuilt.value.defaultMode.toUpperCase();
}

const multiModeLayer = defineTokenLayer<"light" | "dark">({
  id: "application",
  modes: ["light", "dark"],
  tokens: {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
  },
});
const multiModeLayerBuilt = buildScheme({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [multiModeLayer],
});
if (multiModeLayerBuilt.ok) {
  multiModeLayerBuilt.value.defaultMode.toUpperCase();
}

const cssOptions: ExportCssVarsOptions = { prefix: "theme" };
cssOptions.prefix?.toUpperCase();
const cssExport = exportCssVars({} as never);
if (cssExport.ok) {
  const cssVarsExport: CssVarsExport = cssExport.value;
  const firstBlock: CssVarBlock | undefined = cssVarsExport.blocks[0];
  cssVarsExport.css.toUpperCase();
  firstBlock?.selector.toUpperCase();
  firstBlock?.declarations[0]?.property.toUpperCase();
  cssVarsExport.variableByToken.background?.toUpperCase();
}

const legacyCssOptions: ExportCssVarsOptions = {
  // @ts-expect-error variablePrefix is not part of the public CSS export options.
  variablePrefix: "theme",
};
legacyCssOptions.prefix?.toUpperCase();

defineTokenGraph({
  modes: ["light", "dark"],
  // @ts-expect-error defaultMode must be one of the declared modes.
  defaultMode: "sepia",
  defaultVisibility: "public",
  tokens: {},
});

defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    // @ts-expect-error dark mode is required.
    "app.background": {
      valueByMode: {
        light: "#ffffff",
      },
    },
  },
});
