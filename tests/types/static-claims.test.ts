// A precise static claim is nominal: only the helpers' signatures, and the values that flow
// from them, carry one. Raw data, spread copies, and mapped types can claim only the dynamic
// forms, which accept any structurally valid artifact.
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  orThrow,
  parseTokenGraph,
  parseTokenLayer,
  tokenRef,
  type CompiledScheme,
  type DefinedTokenGraph,
  type TokenDefinition,
  type TokenGraph,
  type TokenLayer,
  type TokenVisibility,
} from "scheme-tokens";
import type { Equal, Expect, GraphKeys, IsComplete, PublicKeys } from "./type-assertions.js";

// Raw data that a finite claim would misdescribe. Each one is valid dynamic data.
const realOnly = {
  kind: "scheme-tokens/token-graph",
  formatVersion: 2,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { real: { value: "hello" } },
} as const;
const hiddenReal = {
  kind: "scheme-tokens/token-graph",
  formatVersion: 2,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { real: { value: "hello", visibility: "internal" } },
} as const;
const omittedInternal = {
  kind: "scheme-tokens/token-layer",
  formatVersion: 2,
  id: "omitted-internal",
  defaultVisibility: "internal",
  tokens: { x: { value: "1" } },
} as const;
const pairTokens = { x: { value: "1" }, y: { value: "2" } };

// Graph key forgery: the runtime has only `real`.
// @ts-expect-error raw data cannot claim a key it does not prove.
export const ghostKey: TokenGraph<"real" | "ghost", "base", "real" | "ghost"> = realOnly;
// @ts-expect-error nor the exact key set it happens to have.
export const exactRaw: TokenGraph<"real", "base", "real"> = realOnly;
// Graph public-key forgery: `real` is internal at runtime.
// @ts-expect-error raw data cannot claim a public set.
export const hiddenPublic: TokenGraph<"real", "base", "real"> = hiddenReal;
// Graph mode forgery: compiled mode maps would claim a mode the runtime lacks.
// @ts-expect-error raw data cannot claim a mode set.
export const extraMode: TokenGraph<string, "base" | "dark"> = realOnly;
// Layer visibility forgery: `x` omits visibility, so the default makes it internal.
// @ts-expect-error raw data cannot claim visibility facts.
export const forgedVisibility: TokenLayer<
  "x",
  never,
  {
    readonly default: "internal";
    readonly public: "x";
    readonly internal: never;
    readonly omitted: never;
  }
> = omittedInternal;
// Layer key forgery: the runtime key set is `x | y`.
// @ts-expect-error raw data cannot hide a key.
export const hiddenLayerKey: TokenLayer<
  "x",
  never,
  {
    readonly default: "internal";
    readonly public: never;
    readonly internal: never;
    readonly omitted: "x";
  }
> = {
  kind: "scheme-tokens/token-layer",
  formatVersion: 2,
  id: "hiding",
  defaultVisibility: "internal",
  tokens: pairTokens,
};
// @ts-expect-error a layer claim is nominal even when its key set is dynamic.
export const rawModeLayer: TokenLayer<string, never> = omittedInternal;

// The dynamic forms accept the same data.
export const dynamicGraph: TokenGraph = realOnly;
export const dynamicLayer: TokenLayer = omittedInternal;

// Unproven data compiles as dynamic data.
const rawAll = orThrow(compileTokenGraph(realOnly, { selection: "all" }));
export type RawAll = Expect<Equal<typeof rawAll, CompiledScheme<string, string, false>>>;
// @ts-expect-error a raw graph proves no key.
rawAll.tokens.real.base.toUpperCase();
const rawPublic = orThrow(compileTokenGraph(hiddenReal));
export type RawPublic = Expect<Equal<IsComplete<typeof rawPublic>, false>>;

// A parsed value is dynamic.
const parsedGraph = orThrow(parseTokenGraph({}));
const parsedLayer = orThrow(parseTokenLayer({}));
// @ts-expect-error a parsed graph proves no finite key set.
export const parsedKeys: TokenGraph<"real", string> = parsedGraph;
// @ts-expect-error nor a finite mode set.
export const parsedModes: TokenGraph<string, "base"> = parsedGraph;
// @ts-expect-error a parsed layer proves no finite key set.
export const parsedLayerKeys: TokenLayer<"x"> = parsedLayer;
export const parsedDynamic: TokenGraph = parsedGraph;
export const parsedLayerDynamic: TokenLayer = parsedLayer;

// A helper value satisfies exactly its own claim and every dynamic form.
const graph = defineTokenGraph({
  tokens: { real: "hello", hidden: { value: "secret", visibility: "internal" } },
});
export const exactGraph: TokenGraph<"real" | "hidden", "base", "real"> = graph;
export const keysOnly: TokenGraph<"real" | "hidden", "base"> = graph;
export const modesOnly: TokenGraph<string, "base"> = graph;
export const anyGraph: TokenGraph = graph;
// @ts-expect-error a claim cannot add a key.
export const addedKey: TokenGraph<"real" | "hidden" | "ghost", "base"> = graph;
// @ts-expect-error nor hide one.
export const droppedKey: TokenGraph<"real", "base"> = graph;
// @ts-expect-error nor publish an internal key.
export const addedPublic: TokenGraph<"real" | "hidden", "base", "real" | "hidden"> = graph;
// @ts-expect-error nor add a mode.
export const addedMode: TokenGraph<"real" | "hidden", "base" | "dark"> = graph;

const layer = defineTokenLayer({
  id: "stated",
  defaultVisibility: "internal",
  tokens: { x: "1", y: { value: "2", visibility: "public" } },
});
export const exactLayer: TokenLayer<
  "x" | "y",
  never,
  {
    readonly default: "internal";
    readonly public: "y";
    readonly internal: never;
    readonly omitted: "x";
  }
> = layer;
// A wider visibility type only adds possibilities.
export const widerLayer: TokenLayer<
  "x" | "y",
  never,
  {
    readonly default: TokenVisibility;
    readonly public: "x" | "y";
    readonly internal: "x";
    readonly omitted: "x" | "y";
  }
> = layer;
export const keyedLayer: TokenLayer<"x" | "y"> = layer;
export const anyLayer: TokenLayer = layer;
// @ts-expect-error a claim cannot publish a key whose declaration omits visibility.
export const narrowerLayer: TokenLayer<
  "x" | "y",
  never,
  {
    readonly default: "internal";
    readonly public: "x" | "y";
    readonly internal: never;
    readonly omitted: never;
  }
> = layer;
// @ts-expect-error a layer claim cannot hide a key.
export const hiddenKey: TokenLayer<"x"> = layer;

// A wider layer composes conservatively.
const widerGraph = defineTokenGraph({ layers: [widerLayer], tokens: {} });
export type WiderGraphPublic = Expect<Equal<PublicKeys<typeof widerGraph>, string>>;

// A spread copy or a mapped type loses the proof, so an override cannot keep a stale claim.
// @ts-expect-error a spread copy with another default no longer proves the public set.
export const respread: typeof graph = { ...graph, defaultVisibility: "internal" };
// @ts-expect-error a spread copy of a layer proves nothing either.
export const respreadLayer: typeof layer = { ...layer, defaultVisibility: "public" };
const frozen = Object.freeze(graph);
// @ts-expect-error a mapped type does not carry the proof.
export const frozenExact: TokenGraph<"real" | "hidden", "base", "real"> = frozen;
const spreadAll = orThrow(compileTokenGraph({ ...graph, defaultVisibility: "internal" }));
export type SpreadAll = Expect<Equal<IsComplete<typeof spreadAll>, false>>;

// A raw layer inside a helper graph is dynamic: it may declare any key.
const rawLayerGraph = defineTokenGraph({
  layers: [omittedInternal],
  tokens: { alias: tokenRef("x"), other: tokenRef("anything.else") },
});
export type RawLayerGraphKeys = Expect<Equal<GraphKeys<typeof rawLayerGraph>, string>>;
export type RawLayerGraphPublic = Expect<Equal<PublicKeys<typeof rawLayerGraph>, string>>;

// Union members keep their exact claims: TypeScript cannot reduce one layer claim to another.
const publicX = defineTokenLayer({
  id: "public-x",
  tokens: { x: { value: "1", visibility: "public" } },
});
const omittedX = defineTokenLayer({ id: "omitted-x", tokens: { x: "1" } });
export type OmittedIsNotPublic = Expect<
  Equal<typeof omittedX extends typeof publicX ? true : false, false>
>;
export type PublicIsNotOmitted = Expect<
  Equal<typeof publicX extends typeof omittedX ? true : false, false>
>;
declare const choosePublic: boolean;
const eitherLayerGraph = defineTokenGraph({
  layers: [choosePublic ? publicX : omittedX],
  tokens: {},
});
export type EitherLayerPublic = Expect<Equal<PublicKeys<typeof eitherLayerGraph>, string>>;

// The graph's own keys are definite in `tokens`; a layer-only key is not promised there.
const layerOnly = defineTokenLayer({
  id: "layer",
  tokens: { "layer.only": "#000", shared: "#111" },
});
const direct = defineTokenGraph({
  layers: [layerOnly],
  tokens: { direct: "#fff", override: "#123456", shared: "#222" },
});
export type DirectGraph = Expect<
  Equal<
    typeof direct,
    DefinedTokenGraph<
      "layer.only" | "shared" | "direct" | "override",
      "base",
      "layer.only" | "shared" | "direct" | "override",
      "direct" | "override" | "shared"
    >
  >
>;
direct.tokens.direct.value.toString();
direct.tokens.override.value.toString();
direct.tokens.shared.value.toString();
// @ts-expect-error a key only the layer declares is not a graph-owned declaration.
direct.tokens["layer.only"].value.toString();
export type DirectKeys = Expect<
  Equal<GraphKeys<typeof direct>, "layer.only" | "shared" | "direct" | "override">
>;
export const directAsGraph: TokenGraph<
  "layer.only" | "shared" | "direct" | "override",
  "base",
  "layer.only" | "shared" | "direct" | "override"
> = direct;
const directAll = orThrow(compileTokenGraph(direct, { selection: "all" }));
export type DirectAll = Expect<
  Equal<
    typeof directAll,
    CompiledScheme<"layer.only" | "shared" | "direct" | "override", "base", true>
  >
>;
directAll.tokens["layer.only"].base.toUpperCase();

// Mode maps keep the graph modes in the definite record.
const modal = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { surface: { light: "#fff", dark: "#000" } },
});
export type ModalToken = Expect<
  Equal<(typeof modal.tokens)["surface"], TokenDefinition<string, "light" | "dark">>
>;

// Dynamic records stay dynamic.
const dynamicTokens: Record<string, string> = { a: "1" };
const dynamicDirect = defineTokenGraph({ tokens: dynamicTokens });
export type DynamicDirectKeys = Expect<Equal<keyof typeof dynamicDirect.tokens, string>>;
export type ParsedTokens = Expect<
  Equal<(typeof parsedGraph)["tokens"], Readonly<Record<string, TokenDefinition<string, string>>>>
>;

// Helper results stay nameable in emitted declarations.
export const exportedGraph = direct;
export const exportedLayer = layerOnly;
export const exportedParsed = parsedGraph;
