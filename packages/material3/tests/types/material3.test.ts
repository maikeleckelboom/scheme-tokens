import {
  material3,
  type Material3GraphFragment,
  type Material3TokenKey,
} from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  tokenRef,
  type TokenLayer,
} from "scheme-tokens";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;
type ModeOfFragment<Value> = Value extends Material3GraphFragment<infer Mode> ? Mode : never;

const defaults = material3("#6750a4");
export type DefaultsModeProof = Expect<Equal<ModeOfFragment<typeof defaults>, "light" | "dark">>;
export type DefaultsLayerProof = Expect<
  Equal<(typeof defaults.layers)[0], TokenLayer<Material3TokenKey, string>>
>;

const validMaterialReference = tokenRef("md.sys.color.primary");
void validMaterialReference;
// @ts-expect-error Material token keys are a finite exact union.
const misspelledMaterialReference: ReturnType<typeof tokenRef<Material3TokenKey>> =
  tokenRef("md.sys.color.primari");
void misspelledMaterialReference;

const additive = material3("#6750a4", {
  modes: {
    dark: { variant: "expressive" },
    "light-high": { appearance: "light", contrastLevel: 1 },
  },
  defaultMode: "light-high",
});
export type AdditiveModeProof = Expect<
  Equal<ModeOfFragment<typeof additive>, "light" | "dark" | "light-high">
>;

const exact = material3("#6750a4", {
  exactModes: {
    standard: { appearance: "light" },
    inverse: { appearance: "dark" },
  },
  defaultMode: "standard",
});
export type ExactModeProof = Expect<Equal<ModeOfFragment<typeof exact>, "standard" | "inverse">>;

material3("#6750a4", { defaultMode: "dark" });
material3("#6750a4", {
  exactModes: { light: {}, dark: {} },
  defaultMode: "light",
});

// @ts-expect-error appearance is redundant for the exact light mode.
material3("#6750a4", { exactModes: { light: { appearance: "light" } }, defaultMode: "light" });
// @ts-expect-error appearance is redundant for the exact dark mode.
material3("#6750a4", { exactModes: { dark: { appearance: "dark" } }, defaultMode: "dark" });
// @ts-expect-error custom modes require an explicit appearance.
material3("#6750a4", { modes: { "light-high": { contrastLevel: 1 } } });
// @ts-expect-error defaultMode cannot invent an additive mode.
material3("#6750a4", { defaultMode: "midnight" });
// @ts-expect-error an exact default must belong to exactModes.
material3("#6750a4", {
  exactModes: { standard: { appearance: "light" } },
  defaultMode: "light",
});
material3("#6750a4", {
  modes: { dark: { variant: "expressive" } },
  // @ts-expect-error modes and exactModes are mutually exclusive.
  exactModes: { inverse: { appearance: "dark" } },
  defaultMode: "dark",
});
// @ts-expect-error platform is not public configuration.
material3("#6750a4", { platform: "phone" });
// @ts-expect-error specVersion is global, not per-mode.
material3("#6750a4", { modes: { dark: { specVersion: "2025" } } });
// @ts-expect-error visibility is global, not per-mode.
material3("#6750a4", { modes: { dark: { visibility: "internal" } } });

const defaultGraph = defineTokenGraph({
  ...defaults,
  tokens: { "surface.canvas": tokenRef("md.sys.color.surface") },
});
export type DefaultGraphModeProof = Expect<
  Equal<(typeof defaultGraph.modes)[number], "light" | "dark">
>;
const defaultCompiled = compileTokenGraph(defaultGraph, { selection: "all" });
if (defaultCompiled.ok) {
  type DefaultCompiledModeProof = Expect<
    Equal<(typeof defaultCompiled.value.modes)[number], "light" | "dark">
  >;
  const proof: DefaultCompiledModeProof = true;
  void proof;
}

defineTokenGraph({
  ...defaults,
  tokens: {
    // @ts-expect-error real core rejects a misspelled Material role.
    "surface.canvas": tokenRef("md.sys.color.surfase"),
  },
});

const exactGraph = defineTokenGraph({
  ...exact,
  tokens: { "surface.canvas": tokenRef("md.sys.color.surface") },
});
const exactCompiled = compileTokenGraph(exactGraph, { selection: "all" });
if (exactCompiled.ok) {
  type ExactCompiledModeProof = Expect<
    Equal<(typeof exactCompiled.value.modes)[number], "standard" | "inverse">
  >;
  const proof: ExactCompiledModeProof = true;
  void proof;
}

const additionalLayer = defineTokenLayer({
  id: "brand-overrides",
  tokens: {
    "brand.seed": { light: "#6750a4", dark: "#d0bcff" },
  },
});
const multiLayerGraph = defineTokenGraph({
  ...defaults,
  layers: [...defaults.layers, additionalLayer],
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "brand.semantic": tokenRef("brand.seed"),
  },
});
const allMultiLayer = compileTokenGraph(multiLayerGraph, { selection: "all" });
if (allMultiLayer.ok) {
  type MultiLayerKeyProof = Expect<
    Equal<
      keyof typeof allMultiLayer.value.tokens,
      Material3TokenKey | "brand.seed" | "surface.canvas" | "brand.semantic"
    >
  >;
  const proof: MultiLayerKeyProof = true;
  void proof;
}

defineTokenGraph({
  ...defaults,
  layers: [...defaults.layers, additionalLayer],
  tokens: {
    // @ts-expect-error typo in the Material tuple member is rejected.
    "surface.canvas": tokenRef("md.sys.color.surfase"),
  },
});
defineTokenGraph({
  ...defaults,
  layers: [...defaults.layers, additionalLayer],
  tokens: {
    // @ts-expect-error typo in the second tuple member is rejected.
    "brand.semantic": tokenRef("brand.sead"),
  },
});
