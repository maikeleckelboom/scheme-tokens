import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  tokenRef,
  type TokenLayer,
  type TokenVisibility,
} from "scheme-tokens";
import type { Material3TokenKey } from "../material3-contract.ts";

type Material3Appearance = "light" | "dark";
type Material3SpecVersion = "2021" | "2025";
type Material3Variant =
  | "monochrome"
  | "neutral"
  | "tonal-spot"
  | "vibrant"
  | "expressive"
  | "fidelity"
  | "content"
  | "rainbow"
  | "fruit-salad";

interface Material3ModeOverrides {
  readonly sourceColor?: string;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
}

type Material3ModeConfig<Key extends string> = Key extends "light" | "dark"
  ? Material3ModeOverrides & { readonly appearance?: never }
  : Material3ModeOverrides & { readonly appearance: Material3Appearance };

type Material3BuiltInMode = "light" | "dark";

type Material3AdditiveModeMap<Extra extends string> = {
  readonly [Key in Material3BuiltInMode | Extra]?: Material3ModeConfig<Key>;
};

type Material3ExactModeMap<Mode extends string> = {
  readonly [Key in Mode]: Material3ModeConfig<Key>;
};

interface Material3BaseOptions {
  readonly specVersion?: Material3SpecVersion;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
  readonly visibility?: TokenVisibility;
}

type Material3AdditiveModeOptions<Extra extends string> = Material3BaseOptions & {
  readonly modes?: Material3AdditiveModeMap<Extra>;
  readonly exactModes?: never;
  readonly defaultMode?: NoInfer<Material3BuiltInMode | Extra>;
};

type Material3ExactModeOptions<Mode extends string> = Material3BaseOptions & {
  readonly modes?: never;
  readonly exactModes: Material3ExactModeMap<Mode>;
  readonly defaultMode: NoInfer<Mode>;
};

interface Material3GraphFragment<Mode extends string> {
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly layers: readonly [TokenLayer<Material3TokenKey, Mode>];
}

declare function material3<const Mode extends string>(
  sourceColor: string,
  options: Material3ExactModeOptions<Mode>,
): Material3GraphFragment<Mode>;

declare function material3<const Extra extends string = never>(
  sourceColor: string,
  options?: Material3AdditiveModeOptions<Extra>,
): Material3GraphFragment<Material3BuiltInMode | Extra>;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;
type ModeOfFragment<Value> = Value extends Material3GraphFragment<infer Mode> ? Mode : never;

const defaults = material3("#6750a4");
type DefaultsModeProof = Expect<Equal<ModeOfFragment<typeof defaults>, "light" | "dark">>;

const additive = material3("#6750a4", {
  modes: {
    dark: { variant: "expressive" },
    "light-high": { appearance: "light", contrastLevel: 1 },
  },
  defaultMode: "light-high",
});
type AdditiveModeProof = Expect<
  Equal<ModeOfFragment<typeof additive>, "light" | "dark" | "light-high">
>;
const additiveDefaultMode: "light" | "dark" | "light-high" = additive.defaultMode;
void additiveDefaultMode;

const exact = material3("#6750a4", {
  exactModes: {
    standard: { appearance: "light" },
    inverse: { appearance: "dark" },
  },
  defaultMode: "standard",
});
type ExactModeProof = Expect<Equal<ModeOfFragment<typeof exact>, "standard" | "inverse">>;

material3("#6750a4", {
  exactModes: {
    light: {},
    dark: {},
  },
  defaultMode: "light",
});

// @ts-expect-error appearance is redundant for the exact light mode.
material3("#6750a4", { exactModes: { light: { appearance: "light" } }, defaultMode: "light" });

// @ts-expect-error appearance is redundant for the exact dark mode.
material3("#6750a4", { exactModes: { dark: { appearance: "dark" } }, defaultMode: "dark" });

material3("#6750a4", {
  modes: { dark: { variant: "expressive" } },
  // @ts-expect-error modes and exactModes are mutually exclusive.
  exactModes: { inverse: { appearance: "dark" } },
  defaultMode: "dark",
});

// @ts-expect-error custom modes require an explicit appearance.
material3("#6750a4", { modes: { "light-high": { contrastLevel: 1 } } });

// @ts-expect-error defaultMode cannot introduce a mode.
material3("#6750a4", { defaultMode: "midnight" });

// @ts-expect-error an exact defaultMode must belong to exactModes.
material3("#6750a4", {
  exactModes: { standard: { appearance: "light" } },
  defaultMode: "light",
});

const defaultGraph = defineTokenGraph({
  ...defaults,
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
  },
});
type DefaultGraphModeProof = Expect<Equal<(typeof defaultGraph.modes)[number], "light" | "dark">>;

defineTokenGraph({
  ...defaults,
  tokens: {
    // @ts-expect-error real core rejects a misspelled finite Material role reference.
    "surface.canvas": tokenRef("md.sys.color.surfase"),
  },
});

const exactGraph = defineTokenGraph({
  ...exact,
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
  },
});
const exactCompiled = compileTokenGraph(exactGraph, { selection: "all" });
if (exactCompiled.ok) {
  type ExactCompiledModeProof = Expect<
    Equal<(typeof exactCompiled.value.modes)[number], "standard" | "inverse">
  >;
  const exactCompiledModeProof: ExactCompiledModeProof = true;
  void exactCompiledModeProof;
}

const additionalLayer = defineTokenLayer({
  id: "brand-overrides",
  tokens: {
    "brand.seed": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
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
  const multiLayerKeyProof: MultiLayerKeyProof = true;
  void multiLayerKeyProof;
}

defineTokenGraph({
  ...defaults,
  layers: [...defaults.layers, additionalLayer],
  tokens: {
    // @ts-expect-error real core rejects a typo in the Material tuple member.
    "surface.canvas": tokenRef("md.sys.color.surfase"),
  },
});

defineTokenGraph({
  ...defaults,
  layers: [...defaults.layers, additionalLayer],
  tokens: {
    // @ts-expect-error real core rejects a typo in the second tuple member.
    "brand.semantic": tokenRef("brand.sead"),
  },
});

export type Material3TypeProbeProofs =
  | DefaultsModeProof
  | AdditiveModeProof
  | ExactModeProof
  | DefaultGraphModeProof;
