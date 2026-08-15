import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Hct,
  MaterialDynamicColors,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
  type DynamicColor,
  type DynamicScheme,
} from "@material/material-color-utilities";
import {
  excludedEngineRoles,
  material3HelperMethods,
  material3RoleDefinitions,
} from "../material3-contract.ts";

declare const __MATERIAL_COLOR_UTILITIES_VERSION__: string;

const enginePackage = "@material/material-color-utilities";
const expectedEngineVersion = "0.4.0";
const evidenceFormatVersion = 1;
const appearances = ["light", "dark"] as const;
const contrastLevels = [-1, 0, 0.5, 1] as const;
const seeds = [
  "#6750a4",
  "#006a60",
  "#b3261e",
  "#ffbf00",
  "#0095a8",
  "#777777",
  "#8a8c2a",
  "#009489",
] as const;

const variantConstructors = {
  monochrome: SchemeMonochrome,
  neutral: SchemeNeutral,
  "tonal-spot": SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  "fruit-salad": SchemeFruitSalad,
} as const;

const supported2025Variants = new Set<Variant>(["neutral", "tonal-spot", "vibrant", "expressive"]);
const fallback2025Variants = new Set<Variant>([
  "monochrome",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
]);

const goldenCoordinates = [
  {
    fileName: "material3-0.4.0-6750a4-2021-tonal-spot-phone.json",
    seed: "#6750a4",
    specVersion: "2021",
    variant: "tonal-spot",
    contrastLevel: 0,
    source:
      "scheme-tokens commit d56f39fa84f631eed1f73065a33b22eb9fc39334 historical reference vector",
  },
  {
    fileName: "material3-0.4.0-6750a4-2025-tonal-spot-phone.json",
    seed: "#6750a4",
    specVersion: "2025",
    variant: "tonal-spot",
    contrastLevel: 0,
    source: "spec transition vector: identical seed/variant/contrast to the 2021 baseline",
  },
  {
    fileName: "material3-0.4.0-8a8c2a-2025-expressive-c1-phone.json",
    seed: "#8a8c2a",
    specVersion: "2025",
    variant: "expressive",
    contrastLevel: 1,
    source:
      "hard path: seed selected so neutralPalette.hue enters Hct.isYellow (105..125), exercising the 2025 expressive chroma-multiplier branch",
  },
  {
    fileName: "material3-0.4.0-009489-2025-expressive-c1-phone.json",
    seed: "#009489",
    specVersion: "2025",
    variant: "expressive",
    contrastLevel: 1,
    source:
      "hard path: seed selected so primaryPalette.hue enters Hct.isCyan (170..207), exercising the second 2025 expressive hue branch",
  },
] as const satisfies readonly GoldenCoordinate[];

type Appearance = (typeof appearances)[number];
type SpecVersion = "2021" | "2025";
type Variant = keyof typeof variantConstructors;

interface SchemeCoordinate {
  readonly seed: string;
  readonly specVersion: SpecVersion;
  readonly variant: Variant;
  readonly contrastLevel: number;
  readonly appearance: Appearance;
}

interface GoldenCoordinate {
  readonly fileName: string;
  readonly seed: string;
  readonly specVersion: SpecVersion;
  readonly variant: Variant;
  readonly contrastLevel: number;
  readonly source: string;
}

interface Material3EvidenceSummary {
  readonly engineVersion: string;
  readonly acceptedRoleCount: number;
  readonly excludedRoleCount: number;
  readonly classifiedRoleMethodCount: number;
  readonly helperMethods: readonly string[];
  readonly capabilityByVariant: Readonly<
    Record<
      string,
      {
        readonly differentRoleValueCount: number;
        readonly requested2025EffectiveSpecs: readonly string[];
      }
    >
  >;
  readonly branchCertifications: unknown;
  readonly specTransitionDifferentValueCount: number;
  readonly generatedFiles: readonly string[];
}

export function generateMaterial3Evidence(outputDirectory: string): Material3EvidenceSummary {
  assert(
    __MATERIAL_COLOR_UTILITIES_VERSION__ === expectedEngineVersion,
    `Expected ${enginePackage}@${expectedEngineVersion}, received ${__MATERIAL_COLOR_UTILITIES_VERSION__}.`,
  );

  const roleSurface = classifyRoleSurface();
  const hctBranchBoundaries = verifyHctBranchBoundaries();
  const branchCertifications = certifyHardPaths();
  const capabilityByVariant = compareRequestedSpecs();

  mkdirSync(outputDirectory, { recursive: true });
  const fixtures = new Map<string, ReturnType<typeof createGoldenFixture>>();
  for (const coordinate of goldenCoordinates) {
    const fixture = createGoldenFixture(coordinate);
    fixtures.set(coordinate.fileName, fixture);
    writeCanonicalJson(join(outputDirectory, coordinate.fileName), fixture);
  }

  const baseline = requireMapValue(fixtures, "material3-0.4.0-6750a4-2021-tonal-spot-phone.json");
  const transition = requireMapValue(fixtures, "material3-0.4.0-6750a4-2025-tonal-spot-phone.json");
  const specTransitionDifferentValueCount = countFixtureValueDifferences(baseline, transition);
  assert(
    specTransitionDifferentValueCount === 87,
    `Expected 87/96 values to differ across the 2021/2025 tonal-spot transition, received ${specTransitionDifferentValueCount}.`,
  );

  const capabilityFileName = "material3-0.4.0-capability-matrix.json";
  writeCanonicalJson(join(outputDirectory, capabilityFileName), {
    evidenceFormatVersion,
    engine: {
      package: enginePackage,
      version: __MATERIAL_COLOR_UTILITIES_VERSION__,
    },
    inputs: {
      seeds,
      appearances,
      contrastLevels,
      platform: "phone",
      requestedSpecs: ["2021", "2025"],
      variants: Object.keys(variantConstructors),
    },
    roleSurface,
    hctBranchBoundaries,
    branchCertifications,
    capabilityByVariant,
    goldenVectors: {
      files: goldenCoordinates.map((coordinate) => coordinate.fileName),
      specTransitionDifferentValueCount,
    },
  });

  return {
    engineVersion: __MATERIAL_COLOR_UTILITIES_VERSION__,
    acceptedRoleCount: roleSurface.acceptedRoleCount,
    excludedRoleCount: roleSurface.excludedRoleCount,
    classifiedRoleMethodCount: roleSurface.classifiedRoleMethodCount,
    helperMethods: roleSurface.helperMethods,
    capabilityByVariant: Object.fromEntries(
      Object.entries(capabilityByVariant).map(([variant, value]) => [
        variant,
        {
          differentRoleValueCount: value.differentRoleValueCount,
          requested2025EffectiveSpecs: value.requested2025EffectiveSpecs,
        },
      ]),
    ),
    branchCertifications,
    specTransitionDifferentValueCount,
    generatedFiles: [
      ...goldenCoordinates.map((coordinate) => coordinate.fileName),
      capabilityFileName,
    ],
  };
}

function classifyRoleSurface() {
  const colors = new MaterialDynamicColors();
  const prototype = Object.getPrototypeOf(colors) as object;
  const prototypeMethods = Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== "constructor")
    .filter((name) => typeof Reflect.get(prototype, name) === "function")
    .sort(compareCodeUnits);
  const acceptedMethods = material3RoleDefinitions.map((definition) => definition.engineMethod);
  const acceptedMethodSet = new Set<string>(acceptedMethods);
  const acceptedTokenKeys = material3RoleDefinitions.map((definition) => definition.tokenKey);
  const excludedMethods = Object.keys(excludedEngineRoles);
  const helperMethods = [...material3HelperMethods];
  const classifiedRoleMethods = [...acceptedMethods, ...excludedMethods].sort(compareCodeUnits);
  const expectedPrototypeMethods = [...classifiedRoleMethods, ...helperMethods].sort(
    compareCodeUnits,
  );

  assertUnique(acceptedMethods, "accepted engine role method");
  assertUnique(acceptedTokenKeys, "accepted Material token key");
  assertUnique(excludedMethods, "excluded engine role method");
  assertUnique(expectedPrototypeMethods, "classified prototype method");
  assert(material3RoleDefinitions.length === 48, "Expected exactly 48 accepted Material roles.");
  assert(excludedMethods.length === 11, "Expected exactly 11 excluded engine roles.");
  assert(classifiedRoleMethods.length === 59, "Expected exactly 59 classified role methods.");
  assert(
    deepEqual(prototypeMethods, expectedPrototypeMethods),
    `MaterialDynamicColors instance surface drifted. Expected ${expectedPrototypeMethods.join(", ")}; received ${prototypeMethods.join(", ")}.`,
  );
  assert(
    excludedEngineRoles.surfaceTint === "deprecated-md-sys-token",
    "surfaceTint exclusion drifted.",
  );
  for (const method of ["primaryDim", "secondaryDim", "tertiaryDim", "errorDim"] as const) {
    assert(
      excludedEngineRoles[method] === "incoherent-pre-2025-role",
      `Bare dim exclusion drifted for ${method}.`,
    );
  }
  for (const method of [
    "surfaceDim",
    "surfaceBright",
    "primaryFixedDim",
    "secondaryFixedDim",
    "tertiaryFixedDim",
  ]) {
    assert(acceptedMethodSet.has(method), `Supported dim-family role was excluded: ${method}.`);
  }

  return {
    acceptedRoleCount: acceptedMethods.length,
    excludedRoleCount: excludedMethods.length,
    classifiedRoleMethodCount: classifiedRoleMethods.length,
    helperMethods,
    prototypeMethods,
    acceptedRoleDefinitions: material3RoleDefinitions,
    excludedEngineRoles,
    overlap: [],
    unknownPrototypeMethods: [],
    unclassifiedRoleMethods: [],
  };
}

function verifyHctBranchBoundaries() {
  const boundaries = {
    yellow: {
      predicate: "Hct.isYellow",
      lowerInclusive: 105,
      upperExclusive: 125,
      probes: [104.999, 105, 124.999, 125].map((hue) => ({ hue, result: Hct.isYellow(hue) })),
    },
    cyan: {
      predicate: "Hct.isCyan",
      lowerInclusive: 170,
      upperExclusive: 207,
      probes: [169.999, 170, 206.999, 207].map((hue) => ({ hue, result: Hct.isCyan(hue) })),
    },
  };
  assert(
    deepEqual(
      boundaries.yellow.probes.map((probe) => probe.result),
      [false, true, true, false],
    ),
    "Pinned Hct.isYellow boundary drifted.",
  );
  assert(
    deepEqual(
      boundaries.cyan.probes.map((probe) => probe.result),
      [false, true, true, false],
    ),
    "Pinned Hct.isCyan boundary drifted.",
  );
  return boundaries;
}

function certifyHardPaths() {
  return {
    yellow: certifyDerivedPaletteHue({
      seed: "#8a8c2a",
      palette: "neutralPalette",
      predicate: "Hct.isYellow",
      test: Hct.isYellow,
    }),
    cyan: certifyDerivedPaletteHue({
      seed: "#009489",
      palette: "primaryPalette",
      predicate: "Hct.isCyan",
      test: Hct.isCyan,
    }),
  };
}

function certifyDerivedPaletteHue(input: {
  readonly seed: string;
  readonly palette: "neutralPalette" | "primaryPalette";
  readonly predicate: string;
  readonly test: (hue: number) => boolean;
}) {
  const derivedHues: Record<Appearance, number> = { light: 0, dark: 0 };
  for (const appearance of appearances) {
    const scheme = createScheme({
      seed: input.seed,
      specVersion: "2025",
      variant: "expressive",
      contrastLevel: 1,
      appearance,
    });
    const derivedHue = scheme[input.palette].hue;
    assert(
      input.test(derivedHue),
      `${input.seed} no longer reaches ${input.predicate} through ${input.palette}.hue (${derivedHue}).`,
    );
    derivedHues[appearance] = derivedHue;
  }
  return {
    seed: input.seed,
    specVersion: "2025",
    variant: "expressive",
    contrastLevel: 1,
    platform: "phone",
    palette: input.palette,
    predicate: input.predicate,
    derivedHues,
  };
}

function compareRequestedSpecs() {
  const output = {} as Record<Variant, ReturnType<typeof compareVariantSpecs>>;
  for (const variant of Object.keys(variantConstructors) as Variant[]) {
    output[variant] = compareVariantSpecs(variant);
  }
  return output;
}

function compareVariantSpecs(variant: Variant) {
  const roleMethods = [
    ...material3RoleDefinitions.map((definition) => definition.engineMethod),
    ...Object.keys(excludedEngineRoles),
  ].sort(compareCodeUnits);
  const relationByRole = Object.fromEntries(
    roleMethods.map((method) => [method, { identicalCount: 0, differentCount: 0 }]),
  );
  const coordinateComparisons: Record<string, unknown> = {};
  const requested2021EffectiveSpecs = new Set<string>();
  const requested2025EffectiveSpecs = new Set<string>();
  let differentRoleValueCount = 0;
  let identicalRoleValueCount = 0;

  for (const seed of seeds) {
    for (const appearance of appearances) {
      for (const contrastLevel of contrastLevels) {
        const base = { seed, variant, appearance, contrastLevel };
        const scheme2021 = createScheme({ ...base, specVersion: "2021" });
        const scheme2025 = createScheme({ ...base, specVersion: "2025" });
        const roles2021 = readEngineRoles(scheme2021, roleMethods);
        const roles2025 = readEngineRoles(scheme2025, roleMethods);
        requested2021EffectiveSpecs.add(scheme2021.specVersion);
        requested2025EffectiveSpecs.add(scheme2025.specVersion);
        let coordinateDifferenceCount = 0;

        for (const method of roleMethods) {
          const relation = relationByRole[method];
          assert(relation !== undefined, `Missing role comparison accumulator for ${method}.`);
          if (roles2021[method] === roles2025[method]) {
            relation.identicalCount += 1;
            identicalRoleValueCount += 1;
          } else {
            relation.differentCount += 1;
            differentRoleValueCount += 1;
            coordinateDifferenceCount += 1;
          }
        }

        coordinateComparisons[coordinateId({ seed, appearance, contrastLevel })] = {
          requested2021EffectiveSpec: scheme2021.specVersion,
          requested2025EffectiveSpec: scheme2025.specVersion,
          identicalRoleCount: roleMethods.length - coordinateDifferenceCount,
          differentRoleCount: coordinateDifferenceCount,
          requested2021RoleHash: hashJson(roles2021),
          requested2025RoleHash: hashJson(roles2025),
        };
      }
    }
  }

  const effective2021 = [...requested2021EffectiveSpecs].sort(compareCodeUnits);
  const effective2025 = [...requested2025EffectiveSpecs].sort(compareCodeUnits);
  const coordinateCount = seeds.length * appearances.length * contrastLevels.length;
  const roleComparisonCount = coordinateCount * roleMethods.length;
  assert(deepEqual(effective2021, ["2021"]), `Requested 2021 drifted for ${variant}.`);
  assert(
    identicalRoleValueCount + differentRoleValueCount === roleComparisonCount,
    `Incomplete capability comparisons for ${variant}.`,
  );
  if (fallback2025Variants.has(variant)) {
    assert(deepEqual(effective2025, ["2021"]), `Expected 2025 fallback for ${variant}.`);
    assert(differentRoleValueCount === 0, `Fallback variant ${variant} changed role values.`);
  } else {
    assert(supported2025Variants.has(variant), `Unclassified 2025 capability for ${variant}.`);
    assert(deepEqual(effective2025, ["2025"]), `Expected effective 2025 for ${variant}.`);
    assert(differentRoleValueCount > 0, `Supported 2025 variant ${variant} showed no differences.`);
  }

  return {
    adapterPolicy: supported2025Variants.has(variant) ? "supported" : "rejected-silent-fallback",
    coordinateCount,
    roleComparisonCount,
    identicalRoleValueCount,
    differentRoleValueCount,
    requested2021EffectiveSpecs: effective2021,
    requested2025EffectiveSpecs: effective2025,
    relationByRole,
    coordinateComparisons,
  };
}

function createGoldenFixture(coordinate: GoldenCoordinate) {
  const tokens: Record<string, Record<Appearance, string>> = {};
  for (const appearance of appearances) {
    const scheme = createScheme({ ...coordinate, appearance });
    assert(
      scheme.specVersion === coordinate.specVersion,
      `Golden coordinate fell back from ${coordinate.specVersion} to ${scheme.specVersion}: ${coordinate.fileName}.`,
    );
    const roles = readEngineRoles(
      scheme,
      material3RoleDefinitions.map((definition) => definition.engineMethod),
    );
    for (const definition of material3RoleDefinitions) {
      const value = roles[definition.engineMethod];
      assert(value !== undefined, `Missing golden role value for ${definition.engineMethod}.`);
      const values = tokens[definition.tokenKey] ?? { light: "", dark: "" };
      values[appearance] = value;
      tokens[definition.tokenKey] = values;
    }
  }
  assert(
    Object.keys(tokens).length === 48,
    `Golden fixture ${coordinate.fileName} must contain 48 tokens.`,
  );

  return {
    fixtureFormatVersion: 1,
    provenance: {
      contrastLevel: coordinate.contrastLevel,
      engine: `${enginePackage}@${__MATERIAL_COLOR_UTILITIES_VERSION__}`,
      platform: "phone",
      seed: coordinate.seed.toLowerCase(),
      source: coordinate.source,
      specVersion: coordinate.specVersion,
      variant: coordinate.variant,
    },
    tokens,
  };
}

function createScheme(coordinate: SchemeCoordinate): DynamicScheme {
  const Scheme = variantConstructors[coordinate.variant];
  return new Scheme(
    Hct.fromInt(argbFromHex(coordinate.seed)),
    coordinate.appearance === "dark",
    coordinate.contrastLevel,
    coordinate.specVersion,
    "phone",
  );
}

function readEngineRoles(
  scheme: DynamicScheme,
  methods: readonly string[],
): Readonly<Record<string, string>> {
  const colors = new MaterialDynamicColors();
  const output: Record<string, string> = {};
  for (const method of methods) {
    const factory = Reflect.get(colors, method);
    assert(
      typeof factory === "function",
      `Missing MaterialDynamicColors instance method: ${method}.`,
    );
    const dynamicColor = Reflect.apply(factory, colors, []) as DynamicColor | undefined;
    assert(dynamicColor !== undefined, `MaterialDynamicColors.${method}() returned undefined.`);
    const value = hexFromArgb(scheme.getArgb(dynamicColor)).toLowerCase();
    assert(/^#[0-9a-f]{6}$/u.test(value), `Noncanonical engine color from ${method}: ${value}.`);
    output[method] = value;
  }
  return output;
}

function countFixtureValueDifferences(
  left: ReturnType<typeof createGoldenFixture>,
  right: ReturnType<typeof createGoldenFixture>,
): number {
  let count = 0;
  for (const definition of material3RoleDefinitions) {
    for (const appearance of appearances) {
      if (
        left.tokens[definition.tokenKey]?.[appearance] !==
        right.tokens[definition.tokenKey]?.[appearance]
      ) {
        count += 1;
      }
    }
  }
  return count;
}

function requireMapValue<Key, Value>(map: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = map.get(key);
  assert(value !== undefined, `Missing generated value for ${String(key)}.`);
  return value;
}

function writeCanonicalJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(canonicalize(value), null, 2)}\n`, "utf8");
}

function coordinateId(input: Readonly<Record<string, string | number>>): string {
  return Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
}

function hashJson(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  if (typeof value === "number" && Object.is(value, -0)) {
    return 0;
  }
  return value;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertUnique(values: readonly string[], label: string): void {
  assert(new Set(values).size === values.length, `Duplicate ${label}.`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
