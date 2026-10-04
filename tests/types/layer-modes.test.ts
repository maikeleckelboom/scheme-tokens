// D12 layer mode sets and ADR 0015 structural concat classification.
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  orThrow,
  parseTokenLayer,
  tokenConcat,
  tokenRef,
  type CompiledScheme,
  type TokenExpression,
  type TokenLayer,
  type TokenReference,
} from "scheme-tokens";
import type { Equal, Expect, GraphModes, LayerKeys, LayerModes } from "./type-assertions.js";

// The normative D12 layer: the invariant literal adds no requirement.
const example = defineTokenLayer({
  id: "example",
  tokens: {
    "spacing.sm": "0.5rem",
    "surface.canvas": { light: "#fff", dark: "#000" },
    "surface.raised": { value: { light: "#fafafa", dark: "#111" }, description: "Raised" },
  },
});
export type ExampleModes = Expect<Equal<LayerModes<typeof example>, "light" | "dark">>;
export type ExampleKeys = Expect<
  Equal<LayerKeys<typeof example>, "spacing.sm" | "surface.canvas" | "surface.raised">
>;
export type ExampleDefault = Expect<Equal<typeof example.defaultVisibility, "public">>;

const invariant = defineTokenLayer({
  id: "invariant",
  defaultVisibility: "internal",
  tokens: {
    literal: "1",
    reference: tokenRef("elsewhere"),
    composite: tokenConcat`0 0 0 3px ${tokenRef("elsewhere")}`,
  },
});
export type InvariantModes = Expect<Equal<LayerModes<typeof invariant>, never>>;
export type InvariantDefault = Expect<Equal<typeof invariant.defaultVisibility, "internal">>;
export type InvariantValue = Expect<
  Equal<(typeof invariant.tokens)["literal"]["value"], TokenExpression>
>;

const dynamicMaps: Readonly<Record<"a" | "b", Readonly<Record<string, string>>>> = {
  a: { light: "#fff" },
  b: { light: "#000" },
};
const dynamicModes = defineTokenLayer({ id: "dynamic-modes", tokens: dynamicMaps });
export type DynamicModes = Expect<Equal<LayerModes<typeof dynamicModes>, string>>;
const parsedLayer = orThrow(parseTokenLayer({}));
export type ParsedModes = Expect<Equal<LayerModes<typeof parsedLayer>, string>>;

// An invariant layer fits every graph, including the implicit base mode.
defineTokenGraph({ layers: [invariant], tokens: {} });
defineTokenGraph({
  modes: ["mono-light", "mono-dark", "material3-light"],
  defaultMode: "mono-dark",
  layers: [invariant],
  tokens: {},
});

// A mode set is a set: graph order does not matter.
const reordered = defineTokenGraph({
  modes: ["dark", "light"],
  defaultMode: "light",
  layers: [example],
  tokens: { canvas: tokenRef("surface.canvas") },
});
export type ReorderedModes = Expect<Equal<GraphModes<typeof reordered>, "light" | "dark">>;
const reorderedAll = orThrow(compileTokenGraph(reordered, { selection: "all" }));
export type ReorderedAll = Expect<
  Equal<
    typeof reorderedAll,
    CompiledScheme<
      "spacing.sm" | "surface.canvas" | "surface.raised" | "canvas",
      "light" | "dark",
      true
    >
  >
>;

// Dynamic sets on either side defer to the runtime check.
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  layers: [dynamicModes, parsedLayer],
  tokens: {},
});
declare const runtimeModes: readonly [string, ...string[]];
declare const runtimeDefault: string;
const runtimeGraph = defineTokenGraph({
  modes: runtimeModes,
  defaultMode: runtimeDefault,
  layers: [example],
  tokens: { canvas: tokenRef("surface.canvas") },
});
export type RuntimeGraphModes = Expect<Equal<GraphModes<typeof runtimeGraph>, string>>;

// M7: a light/dark layer in a graph without modes.
defineTokenGraph({
  // @ts-expect-error M7
  layers: [example],
  tokens: {},
});

const dimLayer = defineTokenLayer({
  id: "dim",
  tokens: { "surface.dim": { light: "#fff", dark: "#000", dim: "#333" } },
});
// M8: a light/dark/dim layer in a light/dark graph.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  // @ts-expect-error M8
  layers: [dimLayer],
  tokens: {},
});
// A light/dark layer in a light/dark/dim graph.
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  // @ts-expect-error equality, not inclusion
  layers: [example],
  tokens: {},
});
// M11: the second of two layers is incompatible.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  // @ts-expect-error M11
  layers: [example, dimLayer],
  tokens: {},
});
// Inline authoring is checked the same way.
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  layers: [
    // @ts-expect-error an inline layer keeps its own mode set
    defineTokenLayer({ id: "inline", tokens: { a: { light: "#fff", dark: "#000" } } }),
  ],
  tokens: {},
});

// M9: mode maps inside one layer disagree; the map missing a mode fails.
defineTokenLayer({
  id: "invalid",
  tokens: {
    // @ts-expect-error M9
    a: { light: "#fff", dark: "#000" },
    b: { light: "#fff", dim: "#333", dark: "#000" },
  },
});
defineTokenLayer({
  id: "invalid-expanded",
  tokens: {
    a: { light: "#fff", dark: "#000" },
    // @ts-expect-error the expanded value map lacks dark
    b: { value: { light: "#fff" }, visibility: "internal" },
  },
});
defineTokenLayer({
  id: "invalid-mode-name",
  tokens: {
    a: {
      light: "#fff",
      // @ts-expect-error layer mode names follow the graph mode grammar
      Dark: "#000",
    },
  },
});
defineTokenLayer({
  id: "empty-map",
  tokens: {
    // @ts-expect-error a mode map is never empty
    a: {},
  },
});

// A generic generator returns its declared mode set; `NoInfer` keeps an expected
// mode-bearing context from widening it. The core `LayerModeMismatch` check still applies.
declare function generated<const Mode extends string = "light" | "dark">(
  modes?: readonly Mode[],
): TokenLayer<
  "generated.role",
  NoInfer<Mode>,
  {
    readonly defaultVisibility: "public";
    readonly mayStatePublicKeys: never;
    readonly mayStateInternalKeys: never;
    readonly mayOmitVisibilityKeys: "generated.role";
  }
>;
const generatedDefault = generated();
export type GeneratedDefault = Expect<Equal<LayerModes<typeof generatedDefault>, "light" | "dark">>;
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  // @ts-expect-error the default generated layer stays light/dark inline
  layers: [generated()],
  tokens: {},
});
// @ts-expect-error an annotated variable does not widen the generated mode set
const annotated: TokenLayer<"generated.role", "light" | "dark" | "dim"> = generated();
void annotated;
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  layers: [generated(["light", "dark", "dim"])],
  tokens: { role: tokenRef("generated.role") },
});

// ADR 0015: `concat` is a valid mode name, classified by structure.
const concatGraph = defineTokenGraph({
  modes: ["concat"],
  defaultMode: "concat",
  tokens: {
    a: "A",
    opaque: { concat: "opaque" },
    reference: { concat: tokenRef("a") },
    nested: { concat: { concat: ["x", tokenRef("a")] } },
    direct: { concat: ["x", tokenRef("a")] },
    tagged: tokenConcat`prefix ${tokenRef("a")}`,
  },
});
export type ConcatModes = Expect<Equal<GraphModes<typeof concatGraph>, "concat">>;
const concatCompiled = orThrow(compileTokenGraph(concatGraph));
concatCompiled.tokens.nested.concat.toUpperCase();

defineTokenGraph({
  modes: ["concat", "dark"],
  defaultMode: "dark",
  tokens: {
    a: "A",
    both: { concat: "opaque", dark: "other" },
    direct: { concat: ["x", tokenRef("a")] },
  },
});
defineTokenGraph({
  modes: ["concat", "dark"],
  defaultMode: "dark",
  tokens: {
    // @ts-expect-error a multi-mode map with concat still needs every mode
    both: { concat: "opaque" },
  },
});

const concatLayer = defineTokenLayer({
  id: "concat-layer",
  tokens: {
    mode: { concat: "opaque" },
    expression: { concat: ["x", tokenRef("elsewhere")] },
  },
});
export type ConcatLayerModes = Expect<Equal<LayerModes<typeof concatLayer>, "concat">>;
const multiConcatLayer = defineTokenLayer({
  id: "multi-concat-layer",
  tokens: {
    both: { concat: "opaque", dark: "other" },
    expression: { value: { concat: ["x", tokenRef("elsewhere")] }, visibility: "internal" },
  },
});
export type MultiConcatLayerModes = Expect<
  Equal<LayerModes<typeof multiConcatLayer>, "concat" | "dark">
>;

// tokenConcat returns the canonical shapes the runtime can produce (D5).
const empty = tokenConcat``;
export type EmptyConcat = Expect<Equal<typeof empty, string>>;
const lone = tokenConcat`${tokenRef("a")}`;
export type LoneConcat = Expect<
  Equal<
    typeof lone,
    | TokenReference<"a">
    | {
        readonly concat: readonly [
          string | TokenReference<"a">,
          ...(string | TokenReference<"a">)[],
        ];
      }
  >
>;
const pair = tokenConcat`${tokenRef("a")} ${tokenRef("b")}`;
export type PairConcat = Expect<
  Equal<
    typeof pair,
    {
      readonly concat: readonly [
        string | TokenReference<"a" | "b">,
        ...(string | TokenReference<"a" | "b">)[],
      ];
    }
  >
>;
declare const spread: readonly TokenReference<"a">[];
const spreadConcat = tokenConcat(Object.assign([""], { raw: [""] }), ...spread);
export type SpreadConcat = Expect<Equal<typeof spreadConcat, TokenExpression<"a">>>;
