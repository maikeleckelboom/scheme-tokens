import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  tokenRef,
  type CompileTokenGraphResult,
  type CompiledScheme,
  type CssVarBlock,
  type CssVarsExport,
  type ExportCssVarsOptions,
  type ExportCssVarsResult,
  type ModeOf,
  type TokenGraphInput,
  type TokenKeyOf,
  type TokenLayerInput,
} from "../../src";
import type * as Root from "../../src";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type RootModule = typeof Root;
type RemovedBuildName = `build${"Scheme"}`;
// @ts-expect-error buildScheme is not part of the simplified core API.
export type RemovedBuild = RootModule[RemovedBuildName];
type RemovedBuilderName = `create${"Scheme"}Builder`;
// @ts-expect-error createSchemeBuilder is not part of the simplified core API.
export type RemovedBuilder = RootModule[RemovedBuilderName];
// @ts-expect-error Result is not exported as a public value wrapper.
export type RemovedResult = Root.Result;
// @ts-expect-error old color-prefixed graph type is removed.
export type RemovedColorGraph = Root.ColorTokenGraphInput;
// @ts-expect-error source adapters are not a root public API.
export type RemovedSource = Root.ColorTokenSource;

const simpleGraph = defineTokens({
  "app.background": "#ffffff",
  "app.foreground": tokenRef("app.background"),
});

const typedSimpleGraph = simpleGraph satisfies TokenGraphInput<"base">;
typedSimpleGraph.defaultMode.toUpperCase();
export type SimpleGraphKeys = Expect<
  Equal<TokenKeyOf<typeof simpleGraph>, "app.background" | "app.foreground">
>;
export type SimpleGraphModes = Expect<Equal<ModeOf<typeof simpleGraph>, "base">>;

const multiModeGraph = defineTokens(
  {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
const typedMultiModeGraph = multiModeGraph satisfies TokenGraphInput<"light" | "dark">;
typedMultiModeGraph.defaultMode.toUpperCase();
export type MultiModeGraphModes = Expect<Equal<ModeOf<typeof multiModeGraph>, "light" | "dark">>;

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

const layer = defineTokenLayer({
  id: "brand",
  tokens: {
    "brand.primary": "#6750a4",
  },
});
const typedLayer = layer satisfies TokenLayerInput;
typedLayer.id.toUpperCase();

const graphWithLayer = defineTokenGraph({
  tokens: {
    "app.background": "#ffffff",
  },
  layers: [layer],
});
export type GraphWithLayerKeys = Expect<
  Equal<TokenKeyOf<typeof graphWithLayer>, "app.background" | "brand.primary">
>;

const compiled: CompileTokenGraphResult<"background", "dark" | "light"> =
  compileTokenGraph(multiModeGraph);
if (compiled.ok) {
  const scheme: CompiledScheme<"background", "dark" | "light"> = compiled.scheme;
  scheme.tokens.background.light.toUpperCase();
  scheme.metadataByToken.background.dependenciesByMode.dark.length.toFixed();
  // @ts-expect-error success payload is named scheme, not value.
  compiled.value.defaultMode.toUpperCase();
}

const cssOptions: ExportCssVarsOptions = { prefix: "theme" };
cssOptions.prefix?.toUpperCase();
const cssExport: ExportCssVarsResult = exportCssVars({} as never);
if (cssExport.ok) {
  const cssVarsExport: CssVarsExport = cssExport;
  const firstBlock: CssVarBlock | undefined = cssExport.blocks[0];
  cssVarsExport.css.toUpperCase();
  firstBlock?.selector.toUpperCase();
  firstBlock?.declarations[0]?.property.toUpperCase();
  cssExport.variableByToken.background?.toUpperCase();
  // @ts-expect-error CSS export success payload is direct, not value-wrapped.
  cssExport.value.css.toUpperCase();
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
