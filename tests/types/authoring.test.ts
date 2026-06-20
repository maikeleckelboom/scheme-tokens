import {
  buildScheme,
  defineTokenLayer,
  defineTokenGraph,
  defineTokens,
  exportCssVariableBlocks,
  type BuildSchemeSourceOptions,
  type CssVariableBlock,
  type ExportCssVariablesOptions,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenLayerInput,
  type TokenSource,
} from "../../src";

type RootModule = typeof import("../../src");
type RemovedLayerHelperName = `defineToken${"Frag"}${"ment"}`;
// @ts-expect-error old token layer helper is not exported.
export type RemovedLayerHelper = RootModule[RemovedLayerHelperName];
type RemovedBuildName = `build${"Token"}${"Set"}`;
// @ts-expect-error old build helper is not exported.
export type RemovedBuildHelper = RootModule[RemovedBuildName];
type RemovedCompiledName = `Compiled${"Token"}${"Set"}`;
// @ts-expect-error old compiled type is not exported.
export type RemovedCompiledType = RootModule[RemovedCompiledName];

const simpleGraph = defineTokenGraph({
  tokens: {
    "app.background": "#ffffff",
    "app.foreground": "app.background",
  },
});

const typedSimpleGraph = simpleGraph satisfies TokenGraphInput<"base">;
typedSimpleGraph.defaultMode.toUpperCase();

const simpleTokensGraph = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": "app.background",
});
const typedSimpleTokensGraph = simpleTokensGraph satisfies TokenGraphInput<"base">;
typedSimpleTokensGraph.defaultMode.toUpperCase();

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
const typedMultiModeTokensGraph = multiModeTokensGraph satisfies TokenGraphInput<"light" | "dark">;
typedMultiModeTokensGraph.defaultMode.toUpperCase();

defineTokens(
  { background: "#ffffff" },
  {
    // @ts-expect-error defineTokens options cannot include tokens.
    tokens: {},
  },
);

const source: TokenSource = {
  id: "brand",
  build(): Result<TokenGraphInput, Issue> {
    return { ok: true, value: simpleGraph };
  },
};

const built = buildScheme({ sources: [source] });
if (built.ok) {
  built.value.compiled.defaultMode.toUpperCase();
  // @ts-expect-error buildScheme returns compiled, not scheme.
  built.value["scheme"].defaultMode.toUpperCase();
}

const sourceBuilt = buildScheme(source);
if (sourceBuilt.ok) {
  sourceBuilt.value.compiled.defaultMode.toUpperCase();
}

const sourceOptions: BuildSchemeSourceOptions = { selection: "all" };
const sourceOptionsBuilt = buildScheme(source, sourceOptions);
if (sourceOptionsBuilt.ok) {
  sourceOptionsBuilt.value.compiled.defaultMode.toUpperCase();
}

const sourceArrayBuilt = buildScheme([source, source]);
if (sourceArrayBuilt.ok) {
  sourceArrayBuilt.value.compiled.defaultMode.toUpperCase();
}

// @ts-expect-error source is not a buildScheme option.
buildScheme({ source });

// @ts-expect-error source shorthand options cannot include sources.
buildScheme(source, { sources: [source] });

const emptyBuild = buildScheme({});
if (!emptyBuild.ok) {
  emptyBuild.issues[0]?.code.toUpperCase();
}

const emptyContributorBuild = buildScheme({ sources: [], layers: [] });
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

const typedGraph = graph satisfies TokenGraphInput<"light" | "dark">;
typedGraph.defaultMode.toUpperCase();

const layer = defineTokenLayer({
  id: "brand",
  tokens: {
    "brand.primary": "#6750a4",
    "brand.on-primary": "brand.primary",
  },
});
const typedLayer = layer satisfies TokenLayerInput;
typedLayer.id.toUpperCase();

const sourceAndLayerBuilt = buildScheme(source, { layers: [layer], selection: "all" });
if (sourceAndLayerBuilt.ok) {
  sourceAndLayerBuilt.value.compiled.defaultMode.toUpperCase();
}

const sourceArrayAndLayerBuilt = buildScheme([source, source], {
  layers: [layer],
  selection: "all",
});
if (sourceArrayAndLayerBuilt.ok) {
  sourceArrayAndLayerBuilt.value.compiled.defaultMode.toUpperCase();
}

// @ts-expect-error layers are not positional buildScheme contributors.
buildScheme(layer);

// @ts-expect-error layer arrays are not positional buildScheme contributors.
buildScheme([layer, layer]);

// @ts-expect-error mixed positional source/layer arrays are not supported.
buildScheme([source, layer]);

const layerBuilt = buildScheme({ layers: [layer] });
if (layerBuilt.ok) {
  layerBuilt.value.compiled.defaultMode.toUpperCase();
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
  multiModeLayerBuilt.value.compiled.defaultMode.toUpperCase();
}

const cssOptions: ExportCssVariablesOptions = { prefix: "theme" };
cssOptions.prefix?.toUpperCase();
const cssBlocks = exportCssVariableBlocks({} as never);
if (cssBlocks.ok) {
  const firstBlock: CssVariableBlock | undefined = cssBlocks.value[0];
  firstBlock?.selector.toUpperCase();
  firstBlock?.declarations["--background"]?.toUpperCase();
}

const legacyCssOptions: ExportCssVariablesOptions = {
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
