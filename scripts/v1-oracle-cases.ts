import fc from "fast-check";

export const oracleSeed = 0x4030_2026;
export const oracleCaseCount = 2_000;

type Visibility = "public" | "internal";
type Expression = string | { readonly ref: string } | Readonly<Record<string, string>>;
type Definition = {
  readonly value: Expression;
  readonly visibility?: Visibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, string | number>>;
};
type TokenMap = Readonly<Record<string, Definition>>;

export interface V1GraphCase {
  readonly id: string;
  readonly input: {
    readonly kind: "scheme-tokens/token-graph";
    readonly formatVersion: 1;
    readonly modes: readonly string[];
    readonly defaultMode: string;
    readonly defaultVisibility: Visibility;
    readonly tokens: TokenMap;
    readonly layers: readonly {
      readonly kind: "scheme-tokens/token-layer";
      readonly formatVersion: 1;
      readonly id: string;
      readonly defaultVisibility: Visibility;
      readonly tokens: TokenMap;
    }[];
  };
}

function definition(value: Expression, visibility?: Visibility, name?: string): Definition {
  return {
    value,
    ...(visibility === undefined ? {} : { visibility }),
    ...(name === undefined
      ? {}
      : {
          description: `${name} description`,
          deprecated: `${name} replacement`,
          extensions: { "oracle.owner": name, revision: 1 },
        }),
  };
}

function reference(key: string): Expression {
  return { ref: key };
}

function modeValue(modes: readonly string[], value: string): Expression {
  return Object.fromEntries(modes.map((mode) => [mode, `${value}-${mode}`]));
}

interface Knobs {
  readonly layerCount: 0 | 1 | 2;
  readonly modeCount: 1 | 2 | 3;
  readonly graphInternal: boolean;
  readonly firstLayerInternal: boolean;
  readonly secondLayerInternal: boolean;
  readonly explicitGraph: boolean;
  readonly explicitFirstLayer: boolean;
  readonly explicitSecondLayer: boolean;
  readonly layerReference: boolean;
  readonly secondLayerReference: boolean;
  readonly variant: number;
}

function fromKnobs(id: string, knobs: Knobs): V1GraphCase {
  const modes =
    knobs.modeCount === 1
      ? ["base"]
      : knobs.modeCount === 2
        ? ["dark", "light"]
        : ["dusk", "dark", "light"];
  const defaultMode = modes.includes("light") ? "light" : "base";
  const graphDefault: Visibility = knobs.graphInternal ? "internal" : "public";
  const firstDefault: Visibility = knobs.firstLayerInternal ? "internal" : "public";
  const secondDefault: Visibility = knobs.secondLayerInternal ? "internal" : "public";
  const explicit = (enabled: boolean, currentDefault: Visibility): Visibility | undefined =>
    enabled ? (currentDefault === "public" ? "internal" : "public") : undefined;

  const graphTokens: Record<string, Definition> = {
    "base.value": definition(modeValue(modes, `base-${knobs.variant}`), graphDefault, "base"),
    "shared.value": definition(
      modeValue(modes, `graph-${knobs.variant}`),
      explicit(knobs.explicitGraph, graphDefault),
      "graph-shared",
    ),
    "graph.only": definition(`graph-only-${knobs.variant}`),
    "alias.shared": definition(reference("shared.value")),
  };
  if (knobs.layerCount >= 1) {
    graphTokens["alias.layer"] = definition(reference("layer.only"));
  }
  const layers: V1GraphCase["input"]["layers"][number][] = [];
  if (knobs.layerCount >= 1) {
    layers.push({
      kind: "scheme-tokens/token-layer",
      formatVersion: 1,
      id: "first",
      defaultVisibility: firstDefault,
      tokens: {
        "shared.value": definition(
          knobs.layerReference
            ? reference("base.value")
            : modeValue(modes, `first-${knobs.variant}`),
          explicit(knobs.explicitFirstLayer, firstDefault),
          "first-shared",
        ),
        "layer.only": definition(`first-only-${knobs.variant}`),
        "chain.one": definition(reference("alias.shared")),
      },
    });
  }
  if (knobs.layerCount >= 2) {
    layers.push({
      kind: "scheme-tokens/token-layer",
      formatVersion: 1,
      id: "second",
      defaultVisibility: secondDefault,
      tokens: {
        "shared.value": definition(
          knobs.secondLayerReference
            ? reference("base.value")
            : modeValue(modes, `second-${knobs.variant}`),
          explicit(knobs.explicitSecondLayer, secondDefault),
          "second-shared",
        ),
        "layer.only": definition(`second-only-${knobs.variant}`),
        "chain.two": definition(reference("chain.one")),
      },
    });
  }
  return {
    id,
    input: {
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes,
      defaultMode,
      defaultVisibility: graphDefault,
      tokens: graphTokens,
      layers,
    },
  };
}

export function representativeV1Cases(): readonly V1GraphCase[] {
  const base: Knobs = {
    layerCount: 0,
    modeCount: 1,
    graphInternal: false,
    firstLayerInternal: false,
    secondLayerInternal: false,
    explicitGraph: false,
    explicitFirstLayer: false,
    explicitSecondLayer: false,
    layerReference: false,
    secondLayerReference: false,
    variant: 0,
  };
  return [
    fromKnobs("graph-only", base),
    fromKnobs("graph-layer-collision", { ...base, layerCount: 1, variant: 1 }),
    fromKnobs("ordered-layer-collision", { ...base, layerCount: 2, variant: 2 }),
    fromKnobs("default-visibility-replacement", {
      ...base,
      layerCount: 2,
      graphInternal: true,
      firstLayerInternal: false,
      secondLayerInternal: true,
      variant: 3,
    }),
    fromKnobs("explicit-visibility-metadata", {
      ...base,
      layerCount: 2,
      modeCount: 3,
      graphInternal: true,
      explicitGraph: true,
      explicitFirstLayer: true,
      explicitSecondLayer: true,
      variant: 4,
    }),
    fromKnobs("mode-order-and-reference-chain", {
      ...base,
      layerCount: 2,
      modeCount: 3,
      layerReference: true,
      secondLayerReference: true,
      variant: 5,
    }),
  ];
}

export function randomizedV1Cases(): readonly V1GraphCase[] {
  const arbitrary = fc.record({
    layerCount: fc.constantFrom(0, 1, 2),
    modeCount: fc.constantFrom(1, 2, 3),
    graphInternal: fc.boolean(),
    firstLayerInternal: fc.boolean(),
    secondLayerInternal: fc.boolean(),
    explicitGraph: fc.boolean(),
    explicitFirstLayer: fc.boolean(),
    explicitSecondLayer: fc.boolean(),
    layerReference: fc.boolean(),
    secondLayerReference: fc.boolean(),
    variant: fc.integer({ min: 0, max: 9999 }),
  });
  return fc
    .sample(arbitrary, { seed: oracleSeed, numRuns: oracleCaseCount })
    .map((knobs, index) => fromKnobs(`random-${index.toString().padStart(4, "0")}`, knobs));
}
