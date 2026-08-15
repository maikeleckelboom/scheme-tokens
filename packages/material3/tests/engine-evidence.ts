import { createHash } from "node:crypto";
import {
  Hct,
  MaterialDynamicColors,
  type DynamicColor,
  type DynamicScheme,
} from "@material/material-color-utilities";
import { createMaterial3Scheme } from "../src/engine";
import {
  excludedEngineRoles,
  material3HelperMethods,
  material3RoleDefinitions,
} from "../src/role-catalog";
import type {
  Material3Appearance,
  Material3SpecVersion,
  Material3Variant,
} from "../src/types/material3";

const enginePackage = "@material/material-color-utilities";
export const expectedEngineVersion = "0.4.0";
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
const variants = [
  "monochrome",
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
] as const satisfies readonly Material3Variant[];
const supported2025Variants = new Set<Material3Variant>([
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
]);
const fallback2025Variants = new Set<Material3Variant>([
  "monochrome",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
]);

export const goldenCoordinates = [
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

interface GoldenCoordinate {
  readonly fileName: string;
  readonly seed: string;
  readonly specVersion: Material3SpecVersion;
  readonly variant: Material3Variant;
  readonly contrastLevel: number;
  readonly source: string;
}

export function generateGoldenFixtures(): ReadonlyMap<string, unknown> {
  return new Map(
    goldenCoordinates.map((coordinate) => [coordinate.fileName, createGoldenFixture(coordinate)]),
  );
}

export function generateCapabilityMatrix(): unknown {
  return {
    evidenceFormatVersion: 1,
    engine: { package: enginePackage, version: expectedEngineVersion },
    inputs: {
      seeds,
      appearances,
      contrastLevels,
      platform: "phone",
      requestedSpecs: ["2021", "2025"],
      variants,
    },
    roleSurface: classifyRoleSurface(),
    hctBranchBoundaries: verifyHctBranchBoundaries(),
    branchCertifications: certifyHardPaths(),
    capabilityByVariant: Object.fromEntries(
      variants.map((variant) => [variant, compareVariantSpecs(variant)]),
    ),
    goldenVectors: {
      files: goldenCoordinates.map((coordinate) => coordinate.fileName),
      specTransitionDifferentValueCount: countFixtureValueDifferences(
        createGoldenFixture(goldenCoordinates[0]),
        createGoldenFixture(goldenCoordinates[1]),
      ),
    },
  };
}

export function classifyRoleSurface() {
  const colors = new MaterialDynamicColors();
  const prototype = Object.getPrototypeOf(colors) as object;
  const prototypeMethods = Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== "constructor")
    .filter((name) => typeof Reflect.get(prototype, name) === "function")
    .sort(compareCodeUnits);
  const acceptedMethods = material3RoleDefinitions.map((definition) => definition.engineMethod);
  const acceptedTokenKeys = material3RoleDefinitions.map((definition) => definition.tokenKey);
  const excludedMethods = Object.keys(excludedEngineRoles);
  const helperMethods = [...material3HelperMethods];
  const classifiedRoleMethods = [...acceptedMethods, ...excludedMethods].sort(compareCodeUnits);
  const expectedPrototypeMethods = [...classifiedRoleMethods, ...helperMethods].sort(
    compareCodeUnits,
  );

  assertUnique(acceptedMethods, "accepted engine method");
  assertUnique(acceptedTokenKeys, "accepted token key");
  assertUnique(excludedMethods, "excluded engine method");
  assertUnique(expectedPrototypeMethods, "classified prototype method");
  assert(material3RoleDefinitions.length === 48, "Expected 48 accepted roles.");
  assert(excludedMethods.length === 11, "Expected 11 excluded roles.");
  assert(classifiedRoleMethods.length === 59, "Expected 59 classified role methods.");
  assert(
    deepEqual(prototypeMethods, expectedPrototypeMethods),
    "MaterialDynamicColors instance surface drifted.",
  );

  const acceptedSet = new Set<string>(acceptedMethods);
  for (const method of [
    "surfaceDim",
    "surfaceBright",
    "primaryFixedDim",
    "secondaryFixedDim",
    "tertiaryFixedDim",
    "background",
    "onBackground",
  ]) {
    assert(acceptedSet.has(method), `Required accepted role is missing: ${method}.`);
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

export function verifyHctBranchBoundaries() {
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
    "Hct.isYellow boundary drifted.",
  );
  assert(
    deepEqual(
      boundaries.cyan.probes.map((probe) => probe.result),
      [false, true, true, false],
    ),
    "Hct.isCyan boundary drifted.",
  );
  return boundaries;
}

export function certifyHardPaths() {
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
  const derivedHues: Record<Material3Appearance, number> = { light: 0, dark: 0 };
  for (const appearance of appearances) {
    const scheme = createMaterial3Scheme({
      sourceColor: input.seed,
      specVersion: "2025",
      variant: "expressive",
      contrastLevel: 1,
      appearance,
    });
    const derivedHue = scheme[input.palette].hue;
    assert(
      input.test(derivedHue),
      `${input.seed} no longer reaches ${input.predicate} through ${input.palette}.hue.`,
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

function compareVariantSpecs(variant: Material3Variant) {
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
        const scheme2021 = createMaterial3Scheme({
          sourceColor: seed,
          variant,
          appearance,
          contrastLevel,
          specVersion: "2021",
        });
        const scheme2025 = createMaterial3Scheme({
          sourceColor: seed,
          variant,
          appearance,
          contrastLevel,
          specVersion: "2025",
        });
        const roles2021 = readEngineRoles(scheme2021, roleMethods);
        const roles2025 = readEngineRoles(scheme2025, roleMethods);
        requested2021EffectiveSpecs.add(scheme2021.specVersion);
        requested2025EffectiveSpecs.add(scheme2025.specVersion);
        let coordinateDifferenceCount = 0;

        for (const method of roleMethods) {
          const relation = relationByRole[method];
          assert(relation !== undefined, `Missing comparison accumulator for ${method}.`);
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
    `Incomplete capability comparison for ${variant}.`,
  );
  if (fallback2025Variants.has(variant)) {
    assert(deepEqual(effective2025, ["2021"]), `Expected 2025 fallback for ${variant}.`);
    assert(differentRoleValueCount === 0, `Fallback variant ${variant} changed role values.`);
  } else {
    assert(supported2025Variants.has(variant), `Unclassified 2025 capability for ${variant}.`);
    assert(deepEqual(effective2025, ["2025"]), `Expected effective 2025 for ${variant}.`);
    assert(differentRoleValueCount > 0, `Supported 2025 variant ${variant} did not differ.`);
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
  const tokens: Record<string, Record<Material3Appearance, string>> = {};
  for (const appearance of appearances) {
    const scheme = createMaterial3Scheme({
      sourceColor: coordinate.seed,
      specVersion: coordinate.specVersion,
      variant: coordinate.variant,
      contrastLevel: coordinate.contrastLevel,
      appearance,
    });
    assert(
      scheme.specVersion === coordinate.specVersion,
      `Golden coordinate fell back: ${coordinate.fileName}.`,
    );
    const roles = readEngineRoles(
      scheme,
      material3RoleDefinitions.map((definition) => definition.engineMethod),
    );
    for (const definition of material3RoleDefinitions) {
      const value = roles[definition.engineMethod];
      assert(value !== undefined, `Missing golden value for ${definition.engineMethod}.`);
      const values = tokens[definition.tokenKey] ?? { light: "", dark: "" };
      values[appearance] = value;
      tokens[definition.tokenKey] = values;
    }
  }
  assert(Object.keys(tokens).length === 48, "Golden fixture must contain 48 tokens.");
  return {
    fixtureFormatVersion: 1,
    provenance: {
      contrastLevel: coordinate.contrastLevel,
      engine: `${enginePackage}@${expectedEngineVersion}`,
      platform: "phone",
      seed: coordinate.seed.toLowerCase(),
      source: coordinate.source,
      specVersion: coordinate.specVersion,
      variant: coordinate.variant,
    },
    tokens,
  };
}

function readEngineRoles(
  scheme: DynamicScheme,
  methods: readonly string[],
): Readonly<Record<string, string>> {
  const colors = new MaterialDynamicColors();
  const output: Record<string, string> = {};
  for (const method of methods) {
    const factory = Reflect.get(colors, method);
    assert(typeof factory === "function", `Missing instance method ${method}.`);
    const role = Reflect.apply(factory, colors, []) as DynamicColor | undefined;
    assert(role !== undefined, `MaterialDynamicColors.${method}() returned undefined.`);
    const value = `#${(scheme.getArgb(role) & 0xffffff).toString(16).padStart(6, "0")}`;
    assert(/^#[0-9a-f]{6}$/u.test(value), `Noncanonical engine value for ${method}.`);
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

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function hashJson(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function coordinateId(input: Readonly<Record<string, string | number>>): string {
  return Object.entries(input)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
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
  return typeof value === "number" && Object.is(value, -0) ? 0 : value;
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
