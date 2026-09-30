// Static analogues of the P2 runtime composition cases (ADR 0010/0011, D3/D4): layers
// compose in array order, graph tokens last, and only explicit visibility changes a key.
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  parseTokenGraph,
  parseTokenLayer,
  tokenRef,
  type CompileTokenGraphOptions,
  type CompiledScheme,
  type CssVarsExport,
  type TokenGraph,
  type TokenLayer,
  type TokenVisibility,
} from "scheme-tokens";
import type { Equal, Expect, GraphKeys, IsComplete, PublicKeys } from "./type-assertions.js";

// The first D2 example: an internal source behind a public alias.
const simple = defineTokenGraph({
  tokens: {
    source: { value: "oklch(62% 0.18 250)", visibility: "internal" },
    primary: tokenRef("source"),
    surface: "#ffffff",
  },
});
export type SimpleKeys = Expect<Equal<GraphKeys<typeof simple>, "source" | "primary" | "surface">>;
export type SimplePublic = Expect<Equal<PublicKeys<typeof simple>, "primary" | "surface">>;

const simpleDefault = orThrow(compileTokenGraph(simple));
export type SimpleDefault = Expect<
  Equal<typeof simpleDefault, CompiledScheme<"primary" | "surface", "base", true>>
>;
simpleDefault.tokens.primary.base.toUpperCase();
simpleDefault.metadataByToken.surface.declarations.length.toFixed();
// @ts-expect-error internal keys are not part of the complete public record.
void simpleDefault.tokens.source;

const simplePublic = orThrow(compileTokenGraph(simple, { selection: "public" }));
export type SimplePublicSelection = Expect<
  Equal<typeof simplePublic, CompiledScheme<"primary" | "surface", "base", true>>
>;

const simpleAll = orThrow(compileTokenGraph(simple, { selection: "all" }));
export type SimpleAll = Expect<
  Equal<typeof simpleAll, CompiledScheme<"source" | "primary" | "surface", "base", true>>
>;
simpleAll.tokens.source.base.toUpperCase();

const simpleExact = orThrow(
  compileTokenGraph(simple, { selection: { keys: ["source", "primary"] } }),
);
export type SimpleExact = Expect<
  Equal<typeof simpleExact, CompiledScheme<"source" | "primary", "base", true>>
>;

const runtimeKeys: Array<"source" | "primary"> = ["primary"];
const simpleRuntime = orThrow(compileTokenGraph(simple, { selection: { keys: runtimeKeys } }));
export type SimpleRuntimeArray = Expect<
  Equal<typeof simpleRuntime, CompiledScheme<"source" | "primary", "base", false>>
>;
// @ts-expect-error a runtime array may select fewer keys than its element type names.
simpleRuntime.tokens.primary.base.toUpperCase();

declare const wideOptions: CompileTokenGraphOptions<GraphKeys<typeof simple>>;
const simpleWide = orThrow(compileTokenGraph(simple, wideOptions));
export type SimpleWideSelection = Expect<
  Equal<typeof simpleWide, CompiledScheme<"source" | "primary" | "surface", "base", false>>
>;

declare const publicOrAll: "public" | "all";
const simpleEither = orThrow(compileTokenGraph(simple, { selection: publicOrAll }));
export type SimpleEitherSelection = Expect<Equal<IsComplete<typeof simpleEither>, false>>;

// CSS lookups keep the compiled completeness.
const simpleCss = orThrow(exportCssVars(simpleDefault));
export type SimpleCss = Expect<
  Equal<typeof simpleCss, CssVarsExport<"primary" | "surface", "base", true>>
>;
simpleCss.variableByToken.primary.toUpperCase();
const runtimeCss = orThrow(exportCssVars(simpleRuntime));
export type RuntimeCss = Expect<
  Equal<typeof runtimeCss, CssVarsExport<"source" | "primary", "base", false>>
>;

// A graph default applies only to the keys the graph introduces.
const graphInternal = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: {
    hidden: "a",
    shown: { value: "b", visibility: "public" },
  },
});
export type GraphInternalPublic = Expect<Equal<PublicKeys<typeof graphInternal>, "shown">>;

// Layer introduction uses the layer default.
const publicLayer = defineTokenLayer({ id: "public-layer", tokens: { x: "1" } });
const internalLayer = defineTokenLayer({
  id: "internal-layer",
  defaultVisibility: "internal",
  tokens: { x: "1" },
});
const explicitInternalLayer = defineTokenLayer({
  id: "explicit-internal",
  tokens: { x: { value: "1", visibility: "internal" } },
});
const explicitPublicLayer = defineTokenLayer({
  id: "explicit-public",
  defaultVisibility: "internal",
  tokens: { x: { value: "1", visibility: "public" } },
});
const omittedLayer = defineTokenLayer({ id: "omitted", tokens: { x: "2" } });
const omittedInternalDefaultLayer = defineTokenLayer({
  id: "omitted-internal-default",
  defaultVisibility: "internal",
  tokens: { x: "2" },
});

const introducesPublic = defineTokenGraph({ layers: [publicLayer], tokens: {} });
const introducesInternal = defineTokenGraph({ layers: [internalLayer], tokens: {} });
export type LayerIntroducesPublic = Expect<Equal<PublicKeys<typeof introducesPublic>, "x">>;
export type LayerIntroducesInternal = Expect<Equal<PublicKeys<typeof introducesInternal>, never>>;

// Layer overrides: an omitted visibility preserves, an explicit one replaces.
const publicThenOmitted = defineTokenGraph({ layers: [publicLayer, omittedLayer], tokens: {} });
const internalThenOmitted = defineTokenGraph({
  layers: [internalLayer, omittedLayer],
  tokens: {},
});
const internalThenOmittedInternalDefault = defineTokenGraph({
  layers: [explicitInternalLayer, omittedInternalDefaultLayer],
  tokens: {},
});
const publicThenOmittedInternalDefault = defineTokenGraph({
  layers: [publicLayer, omittedInternalDefaultLayer],
  tokens: {},
});
const internalThenPublic = defineTokenGraph({
  layers: [internalLayer, explicitPublicLayer],
  tokens: {},
});
const publicThenInternal = defineTokenGraph({
  layers: [publicLayer, explicitInternalLayer],
  tokens: {},
});
export type PublicThenOmitted = Expect<Equal<PublicKeys<typeof publicThenOmitted>, "x">>;
export type InternalThenOmitted = Expect<Equal<PublicKeys<typeof internalThenOmitted>, never>>;
export type InternalThenOmittedInternalDefault = Expect<
  Equal<PublicKeys<typeof internalThenOmittedInternalDefault>, never>
>;
export type PublicThenOmittedInternalDefault = Expect<
  Equal<PublicKeys<typeof publicThenOmittedInternalDefault>, "x">
>;
export type InternalThenPublic = Expect<Equal<PublicKeys<typeof internalThenPublic>, "x">>;
export type PublicThenInternal = Expect<Equal<PublicKeys<typeof publicThenInternal>, never>>;

// Graph-last overrides follow the same rule, whatever the graph default is.
const graphOmitsPublic = defineTokenGraph({
  defaultVisibility: "internal",
  layers: [publicLayer],
  tokens: { x: "3", alias: tokenRef("x") },
});
const graphOmitsInternal = defineTokenGraph({ layers: [internalLayer], tokens: { x: "3" } });
const graphRepublishes = defineTokenGraph({
  layers: [internalLayer],
  tokens: { x: { value: "3", visibility: "public" } },
});
const graphHides = defineTokenGraph({
  layers: [publicLayer],
  tokens: { x: { value: "3", visibility: "internal" } },
});
export type GraphOmitsPublic = Expect<Equal<PublicKeys<typeof graphOmitsPublic>, "x">>;
export type GraphOmitsInternal = Expect<Equal<PublicKeys<typeof graphOmitsInternal>, never>>;
export type GraphRepublishes = Expect<Equal<PublicKeys<typeof graphRepublishes>, "x">>;
export type GraphHides = Expect<Equal<PublicKeys<typeof graphHides>, never>>;
export type GraphOmitsPublicKeys = Expect<Equal<GraphKeys<typeof graphOmitsPublic>, "x" | "alias">>;

// Three positions: layer A, then layer B, then the graph.
const internalPublicOmitted = defineTokenGraph({
  layers: [internalLayer, explicitPublicLayer],
  tokens: { x: "4" },
});
const publicOmittedInternal = defineTokenGraph({
  layers: [publicLayer, omittedInternalDefaultLayer],
  tokens: { x: { value: "4", visibility: "internal" } },
});
const publicInternalPublic = defineTokenGraph({
  defaultVisibility: "internal",
  layers: [publicLayer, explicitInternalLayer],
  tokens: { x: { value: "4", visibility: "public" } },
});
const internalOmittedOmitted = defineTokenGraph({
  layers: [explicitInternalLayer, omittedLayer],
  tokens: { x: "4", y: "5" },
});
export type InternalPublicOmitted = Expect<Equal<PublicKeys<typeof internalPublicOmitted>, "x">>;
export type PublicOmittedInternal = Expect<Equal<PublicKeys<typeof publicOmittedInternal>, never>>;
export type PublicInternalPublic = Expect<Equal<PublicKeys<typeof publicInternalPublic>, "x">>;
export type InternalOmittedOmitted = Expect<Equal<PublicKeys<typeof internalOmittedOmitted>, "y">>;

// The D2 Material-shaped example with a hand-authored layer: the override stays internal,
// an explicit republish is public, and the public alias is public.
const roles = defineTokenLayer({
  id: "roles",
  defaultVisibility: "internal",
  tokens: {
    "md.sys.color.primary": { light: "#6750a4", dark: "#d0bcff" },
    "md.sys.color.surface": { light: "#fffbfe", dark: "#1c1b1f" },
    "md.sys.color.error": { light: "#b3261e", dark: "#f2b8b5" },
  },
});
const theme = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [roles],
  tokens: {
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" },
    "md.sys.color.surface": {
      value: { light: "#ffffff", dark: "#000000" },
      visibility: "public",
    },
    primary: tokenRef("md.sys.color.primary"),
  },
});
export type ThemeKeys = Expect<
  Equal<
    GraphKeys<typeof theme>,
    "md.sys.color.primary" | "md.sys.color.surface" | "md.sys.color.error" | "primary"
  >
>;
export type ThemePublic = Expect<
  Equal<PublicKeys<typeof theme>, "md.sys.color.surface" | "primary">
>;
const themeDefault = orThrow(compileTokenGraph(theme));
export type ThemeDefault = Expect<
  Equal<
    typeof themeDefault,
    CompiledScheme<"md.sys.color.surface" | "primary", "light" | "dark", true>
  >
>;
themeDefault.tokens.primary.dark.toUpperCase();
const themeAll = orThrow(compileTokenGraph(theme, { selection: "all" }));
export type ThemeAll = Expect<Equal<IsComplete<typeof themeAll>, true>>;
themeAll.tokens["md.sys.color.error"].light.toUpperCase();

// Visibility that is not a literal keeps the public set unknown and the record partial.
declare const widened: TokenVisibility;
const unknownToken = defineTokenGraph({
  tokens: { a: { value: "1", visibility: widened }, b: "2" },
});
export type UnknownTokenPublic = Expect<Equal<PublicKeys<typeof unknownToken>, string>>;
const unknownTokenDefault = orThrow(compileTokenGraph(unknownToken));
export type UnknownTokenDefault = Expect<
  Equal<typeof unknownTokenDefault, CompiledScheme<"a" | "b", "base", false>>
>;
// @ts-expect-error uncertain visibility never yields a complete public record.
unknownTokenDefault.tokens.b.base.toUpperCase();
const unknownTokenAll = orThrow(compileTokenGraph(unknownToken, { selection: "all" }));
export type UnknownTokenAll = Expect<
  Equal<typeof unknownTokenAll, CompiledScheme<"a" | "b", "base", true>>
>;

const unknownGraphDefault = defineTokenGraph({ defaultVisibility: widened, tokens: { a: "1" } });
export type UnknownGraphDefault = Expect<Equal<PublicKeys<typeof unknownGraphDefault>, string>>;

const unknownLayerDefault = defineTokenLayer({
  id: "unknown",
  defaultVisibility: widened,
  tokens: { x: "1", y: "2" },
});
const unknownLayerGraph = defineTokenGraph({ layers: [unknownLayerDefault], tokens: {} });
export type UnknownLayerGraph = Expect<Equal<PublicKeys<typeof unknownLayerGraph>, string>>;
// Explicit graph visibility on every uncertain key makes the set known again.
const restated = defineTokenGraph({
  layers: [unknownLayerDefault],
  tokens: {
    x: { value: "1", visibility: "public" },
    y: { value: "2", visibility: "internal" },
  },
});
export type Restated = Expect<Equal<PublicKeys<typeof restated>, "x">>;
// An omitted override keeps the uncertainty.
const omittedUncertain = defineTokenGraph({ layers: [unknownLayerDefault], tokens: { x: "1" } });
export type OmittedUncertain = Expect<Equal<PublicKeys<typeof omittedUncertain>, string>>;

// A layer typed only as TokenLayer<Key> has unknown visibility for exactly its keys.
declare const opaqueLayer: TokenLayer<"x" | "y">;
const opaqueGraph = defineTokenGraph({ layers: [opaqueLayer], tokens: { z: "1" } });
export type OpaqueGraph = Expect<Equal<PublicKeys<typeof opaqueGraph>, string>>;
export type OpaqueGraphKeys = Expect<Equal<GraphKeys<typeof opaqueGraph>, "x" | "y" | "z">>;
const opaqueRestated = defineTokenGraph({
  layers: [opaqueLayer],
  tokens: {
    x: { value: "1", visibility: "internal" },
    y: { value: "2", visibility: "public" },
    z: "3",
  },
});
export type OpaqueRestated = Expect<Equal<PublicKeys<typeof opaqueRestated>, "y" | "z">>;

declare const optionalVisibility: { readonly value: string; readonly visibility?: "public" };
const optionalVisibilityGraph = defineTokenGraph({
  defaultVisibility: "internal",
  tokens: { a: optionalVisibility },
});
export type OptionalVisibility = Expect<Equal<PublicKeys<typeof optionalVisibilityGraph>, string>>;

// Dynamic key sets anywhere in the composition make the public set unknown.
const dynamicTokens: Record<string, string> = { a: "1" };
const dynamicGraph = defineTokenGraph({ tokens: dynamicTokens });
export type DynamicGraphKeys = Expect<Equal<GraphKeys<typeof dynamicGraph>, string>>;
export type DynamicGraphPublic = Expect<Equal<PublicKeys<typeof dynamicGraph>, string>>;
const dynamicDefault = orThrow(compileTokenGraph(dynamicGraph));
export type DynamicDefault = Expect<
  Equal<typeof dynamicDefault, CompiledScheme<string, "base", false>>
>;
const dynamicAll = orThrow(compileTokenGraph(dynamicGraph, { selection: "all" }));
export type DynamicAll = Expect<Equal<typeof dynamicAll, CompiledScheme<string, "base", false>>>;

const entries = Object.fromEntries([["from-entries", "#fff"]]);
const fromEntries = defineTokenGraph({ tokens: entries });
export type FromEntriesPublic = Expect<Equal<PublicKeys<typeof fromEntries>, string>>;

const dynamicLayer = defineTokenLayer({ id: "dynamic", tokens: dynamicTokens });
const dynamicLayerGraph = defineTokenGraph({
  layers: [dynamicLayer],
  tokens: { literal: "1" },
});
export type DynamicLayerKeys = Expect<Equal<GraphKeys<typeof dynamicLayerGraph>, string>>;
export type DynamicLayerPublic = Expect<Equal<PublicKeys<typeof dynamicLayerGraph>, string>>;
const dynamicLayerDefault = orThrow(compileTokenGraph(dynamicLayerGraph));
export type DynamicLayerDefault = Expect<Equal<IsComplete<typeof dynamicLayerDefault>, false>>;

const parsedLayer = orThrow(parseTokenLayer({}));
const parsedLayerGraph = defineTokenGraph({ layers: [parsedLayer], tokens: { literal: "1" } });
export type ParsedLayerPublic = Expect<Equal<PublicKeys<typeof parsedLayerGraph>, string>>;
const parsedLayerAll = orThrow(compileTokenGraph(parsedLayerGraph, { selection: "all" }));
export type ParsedLayerAll = Expect<Equal<IsComplete<typeof parsedLayerAll>, false>>;

const parsedGraph = orThrow(parseTokenGraph({}));
const parsedDefault = orThrow(compileTokenGraph(parsedGraph));
export type ParsedDefault = Expect<
  Equal<typeof parsedDefault, CompiledScheme<string, string, false>>
>;
const parsedAll = orThrow(compileTokenGraph(parsedGraph, { selection: "all" }));
export type ParsedAll = Expect<Equal<typeof parsedAll, CompiledScheme<string, string, false>>>;
const parsedExact = orThrow(
  compileTokenGraph(parsedGraph, { selection: { keys: ["runtime-validated.key"] } }),
);
export type ParsedExact = Expect<
  Equal<typeof parsedExact, CompiledScheme<"runtime-validated.key", string, true>>
>;
declare const runtimeKey: string;
const parsedRuntimeKey = orThrow(
  compileTokenGraph(parsedGraph, { selection: { keys: [runtimeKey] } }),
);
export type ParsedRuntimeKey = Expect<
  Equal<typeof parsedRuntimeKey, CompiledScheme<string, string, false>>
>;

// A layer list that is not a tuple has no known order or membership.
const layerList: readonly (typeof publicLayer)[] = [publicLayer];
const listGraph = defineTokenGraph({ layers: layerList, tokens: { y: tokenRef("x") } });
export type ListGraphKeys = Expect<Equal<GraphKeys<typeof listGraph>, string>>;
export type ListGraphPublic = Expect<Equal<PublicKeys<typeof listGraph>, string>>;

// Every declared state is an explicit may-set, so a wider type only adds possibilities.
const statedLayer = defineTokenLayer({
  id: "stated",
  tokens: {
    omitted: "1",
    hidden: { value: "2", visibility: "internal" },
    either: { value: "3", visibility: widened },
  },
});
export type StatedLayerVisibility = Expect<
  Equal<
    typeof statedLayer extends TokenLayer<string, string, infer Visibility> ? Visibility : never,
    {
      readonly default: "public";
      readonly public: "either";
      readonly internal: "hidden" | "either";
      readonly omitted: "omitted";
    }
  >
>;

// A tuple element that is one of several layers has no known key set. TypeScript
// subtype-reduces such a union, so an omitted declaration must not be a subtype of an
// explicit one.
declare const chooseInternal: boolean;
const chosenGraph = defineTokenGraph({
  layers: [chooseInternal ? internalLayer : explicitPublicLayer],
  tokens: {},
});
export type ChosenGraphPublic = Expect<Equal<PublicKeys<typeof chosenGraph>, string>>;
const chosenOmitted = defineTokenGraph({
  layers: [chooseInternal ? internalLayer : omittedLayer],
  tokens: {},
});
export type ChosenOmittedPublic = Expect<Equal<PublicKeys<typeof chosenOmitted>, string>>;

// A union of graphs compiles to one result per graph; their keys never merge.
declare const eitherGraph: typeof simple | typeof graphInternal;
const eitherDefault = orThrow(compileTokenGraph(eitherGraph));
export type EitherDefault = Expect<
  Equal<
    typeof eitherDefault,
    CompiledScheme<"primary" | "surface", "base", true> | CompiledScheme<"shown", "base", true>
  >
>;
// @ts-expect-error neither graph promises the other's public keys.
eitherDefault.tokens.shown.base.toUpperCase();

// A finite key union is an exact claim. Union subtype reduction cannot promise the keys of
// a larger graph for a smaller one, and an annotation cannot add or hide keys.
const smaller = defineTokenGraph({ tokens: { a: "1" } });
const larger = defineTokenGraph({ tokens: { a: "1", b: "2" } });
declare const chooseSmaller: boolean;
const chosenSize = orThrow(
  compileTokenGraph(chooseSmaller ? smaller : larger, { selection: "all" }),
);
export type ChosenSize = Expect<
  Equal<
    typeof chosenSize,
    CompiledScheme<"a", "base", true> | CompiledScheme<"a" | "b", "base", true>
  >
>;
// @ts-expect-error a graph with key a is not a graph with keys a and b.
export const widenedGraph: TokenGraph<"a" | "b", "base", "a" | "b"> = smaller;
// @ts-expect-error nor is it a graph with only key b in its public set.
export const narrowedPublic: TokenGraph<"a" | "b", "base", "b"> = larger;
export const forgotten: TokenGraph<"a" | "b", "base"> = larger;
export const dynamic: TokenGraph = larger;
// @ts-expect-error a parsed graph does not prove a finite key set.
export const claimedParsed: TokenGraph<"a", string, "a"> = parsedGraph;
const pairLayer = defineTokenLayer({ id: "pair", tokens: { x: "1", y: "2" } });
// @ts-expect-error a layer type cannot hide one of its keys.
export const hiddenKey: TokenLayer<"x"> = pairLayer;
export const dynamicLayerType: TokenLayer = pairLayer;
