import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  buildScheme,
  defineTokenLayer,
  parseTokenGraph,
  type Issue,
  type Result,
  type TokenDefinitionInput,
  type TokenGraphInput,
} from "scheme-tokens";
import * as adapter from "../src";
import {
  material3,
  material3Preset,
  material3Platforms,
  material3SpecVersions,
  material3Variants,
  type Material3Input,
  type Material3Issue,
} from "../src";

type GraphValues = Readonly<Record<string, { readonly light: string; readonly dark: string }>>;

function unwrap<Value, I extends Issue>(result: Result<Value, I>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}

describe("material3", () => {
  test("exports the intended runtime API", () => {
    expect(Object.keys(adapter).sort()).toEqual([
      "material3",
      "material3Platforms",
      "material3Preset",
      "material3SpecVersions",
      "material3Variants",
    ]);
    expect(material3Variants).toEqual([
      "monochrome",
      "neutral",
      "tonal-spot",
      "vibrant",
      "expressive",
      "fidelity",
      "content",
      "rainbow",
      "fruit-salad",
      "cmf",
    ]);
    expect(material3SpecVersions).toEqual(["2021", "2025", "2026"]);
    expect(material3Platforms).toEqual(["phone", "watch"]);
  });

  test("creates a structural TokenSource with tested defaults", () => {
    const source = material3("#6750a4");
    const graph = unwrap(source.build());
    const explicitDefaultGraph = unwrap(
      material3({
        sourceColors: "#6750a4",
        variant: "tonal-spot",
        contrastLevel: 0,
        specVersion: "2021",
        platform: "phone",
      }).build(),
    );

    expect(source.id).toBe("material3");
    expect(graph).toMatchObject({
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
    });
    expect(extractGraphTokenValues(graph)).toEqual(extractGraphTokenValues(explicitDefaultGraph));
    expect(Object.keys(graph.tokens)).toContain("material3.primary");
    expect(Object.keys(graph.tokens).some((key) => key.startsWith("material3.palette."))).toBe(
      false,
    );
    expect(parseTokenGraph(graph).ok).toBe(true);
  });

  test("matches sourceColors shorthand to canonical object input", () => {
    const shorthand = unwrap(material3("#6750a4").build());
    const object = unwrap(material3({ sourceColors: "#6750a4" }).build());

    expect(extractGraphTokenValues(shorthand)).toEqual(extractGraphTokenValues(object));
  });

  test("material3Preset delegates defaults and integration options to material3", () => {
    const defaults = {
      variant: "tonal-spot",
      contrastLevel: 0,
      specVersion: "2026",
      platform: "phone",
      extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
    } as const;
    const options = { defaultVisibility: "internal" } as const;
    const preset = material3Preset(defaults, options);
    const presetGraph = unwrap(preset("#6750a4").build());
    const directGraph = unwrap(material3("#6750a4", defaults, options).build());

    expect(extractGraphTokenValues(presetGraph)).toEqual(extractGraphTokenValues(directGraph));
    expect(presetGraph.defaultVisibility).toBe("internal");
  });

  test("material3Preset accepts runtime generation overrides and object input", () => {
    const preset = material3Preset({ variant: "tonal-spot", specVersion: "2026" });
    const shorthandGraph = unwrap(
      preset(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" }).build(),
    );
    const directGraph = unwrap(
      material3(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" }).build(),
    );
    const objectGraph = unwrap(
      preset({ sourceColors: "#6750a4", variant: "expressive", specVersion: "2026" }).build(),
    );
    const expressiveGraph = unwrap(
      material3({ sourceColors: "#6750a4", variant: "expressive", specVersion: "2026" }).build(),
    );

    expect(extractGraphTokenValues(shorthandGraph)).toEqual(extractGraphTokenValues(directGraph));
    expect(extractGraphTokenValues(objectGraph)).toEqual(extractGraphTokenValues(expressiveGraph));
    expect(extractGraphTokenValues(objectGraph)).not.toEqual(
      extractGraphTokenValues(unwrap(preset("#6750a4").build())),
    );
  });

  test("material3Preset replaces array defaults and isolates caller mutation", () => {
    const defaults = {
      extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
      paletteTones: [40],
    };
    const preset = material3Preset(defaults);

    defaults.extendedColors.push({ name: "warning", color: "#f9a825", harmonize: true });
    defaults.paletteTones.push(90);

    const defaultGraph = unwrap(preset("#6750a4").build());
    expect(Object.keys(defaultGraph.tokens)).toContain("material3.extended.success.color");
    expect(Object.keys(defaultGraph.tokens)).not.toContain("material3.extended.warning.color");
    expect(Object.keys(defaultGraph.tokens)).toContain("material3.palette.primary.tone-40");
    expect(Object.keys(defaultGraph.tokens)).not.toContain("material3.palette.primary.tone-90");

    const runtimeInput = {
      sourceColors: "#6750a4",
      extendedColors: [{ name: "warning", color: "#f9a825", harmonize: true }],
    } as const;
    const runtimeGraph = unwrap(preset(runtimeInput).build());

    expect(Object.keys(runtimeGraph.tokens)).not.toContain("material3.extended.success.color");
    expect(Object.keys(runtimeGraph.tokens)).toContain("material3.extended.warning.color");
    expect(runtimeInput.extendedColors[0]?.name).toBe("warning");
  });

  test("material3Preset keeps sourceColors validation runtime-owned", () => {
    expect.hasAssertions();

    const preset = material3Preset({ variant: "tonal-spot" });

    expectIssueCodes(preset([]).build(), ["material3-invalid-source-colors"]);
  });

  test("matches one-item sourceColors array shorthand to scalar shorthand", () => {
    const scalar = unwrap(material3("#6750a4").build());
    const array = unwrap(material3(["#6750a4"]).build());

    expect(extractGraphTokenValues(array)).toEqual(extractGraphTokenValues(scalar));
  });

  test("matches shorthand generation options to canonical object input", () => {
    const shorthand = unwrap(material3("#6750a4", { variant: "expressive" }).build());
    const object = unwrap(material3({ sourceColors: "#6750a4", variant: "expressive" }).build());

    expect(extractGraphTokenValues(shorthand)).toEqual(extractGraphTokenValues(object));
  });

  test("matches shorthand generation and integration options to canonical object input", () => {
    const shorthand = material3(
      "#6750a4",
      { variant: "expressive" },
      { defaultVisibility: "internal" },
    );
    const object = material3(
      { sourceColors: "#6750a4", variant: "expressive" },
      { defaultVisibility: "internal" },
    );
    const shorthandGraph = unwrap(shorthand.build());
    const objectGraph = unwrap(object.build());

    expect(shorthand.id).toBe(object.id);
    expect(shorthandGraph.defaultVisibility).toBe("internal");
    expect(extractGraphTokenValues(shorthandGraph)).toEqual(extractGraphTokenValues(objectGraph));
  });

  test("rejects integration options in shorthand generation options position", () => {
    const result = material3("#6750a4", {
      defaultVisibility: "internal",
    } as unknown as Material3Input).build();

    expectIssueCodes(result, ["material3-invalid-input"]);
    expect(expectIssuePaths(result)).toContain("/defaultVisibility");
  });

  test("rejects generation options in shorthand integration options position", () => {
    const result = material3("#6750a4", {}, { variant: "expressive" } as never).build();

    expectIssueCodes(result, ["material3-invalid-input"]);
    expect(expectIssuePaths(result)).toContain("/variant");
  });

  test("matches scalar sourceColors to a one-item sourceColors array", () => {
    const scalar = unwrap(material3({ sourceColors: "#6750a4" }).build());
    const array = unwrap(material3({ sourceColors: ["#6750a4"] }).build());

    expect(extractGraphTokenValues(array)).toEqual(extractGraphTokenValues(scalar));
  });

  test("uses source id and default visibility from integration options", () => {
    const source = material3(
      { sourceColors: "#6750A4" },
      {
        id: "brand-material",
        defaultVisibility: "internal",
      },
    );
    const graph = unwrap(source.build());

    expect(source.id).toBe("brand-material");
    expect(graph.defaultVisibility).toBe("internal");
    expect(Object.keys(graph.tokens)).toContain("brand-material.primary");
    expect(Object.keys(graph.tokens)).not.toContain("material3.primary");
  });

  test("composes adapter output with caller layers", () => {
    const application = defineTokenLayer<"light" | "dark">({
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.background": "material3.surface",
        "app.foreground": "material3.on-surface",
        "app.action": "material3.primary",
      },
    });

    const built = unwrap(
      buildScheme({
        base: material3({ sourceColors: "#6750a4" }, { defaultVisibility: "internal" }),
        layers: [application],
      }),
    );

    expect(Object.keys(built.tokens)).toEqual(["app.action", "app.background", "app.foreground"]);
    expect(built.tokens["app.action"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("rejects missing, empty, and invalid sourceColors", () => {
    expect.hasAssertions();

    expectIssueCodes(material3({} as Material3Input).build(), ["material3-invalid-source-colors"]);
    expectIssueCodes(material3({ sourceColors: [] } as unknown as Material3Input).build(), [
      "material3-invalid-source-colors",
    ]);
    expectIssueCodes(
      material3({
        sourceColors: ["#6750a4", "rgb(0 0 0)", 42],
      } as unknown as Material3Input).build(),
      ["material3-unsupported-color-input"],
    );
  });

  test("rejects stale first-argument source aliases and output-shaping options", () => {
    const aliases = [
      "sourceColor",
      "color",
      "seedColor",
      "primary",
      "style",
      "customColors",
      `material${"3"}Source`,
      `@scheme-tokens/${"source"}-material3`,
      "isDark",
      "dark",
      "brightnessVariants",
      "modifyColorScheme",
    ] as const;

    for (const alias of aliases) {
      const result = material3({ [alias]: "#6750a4" } as unknown as Material3Input).build();
      expectIssueCodes(result, ["material3-invalid-source-colors", "material3-invalid-input"]);
      expect(expectIssuePaths(result)).toContain(`/${jsonPointerSegment(alias)}`);
    }
  });

  test("rejects integration options in the first argument", () => {
    const result = material3({
      sourceColors: "#6750a4",
      id: "brand-material",
      defaultVisibility: "internal",
    } as unknown as Material3Input).build();

    expectIssueCodes(result, ["material3-invalid-input"]);
    expect(expectIssuePaths(result)).toEqual(expect.arrayContaining(["/id", "/defaultVisibility"]));
  });

  test("rejects integration options in Material 3 generation input", () => {
    for (const generationOptions of [{ id: "material3" }, { defaultVisibility: "internal" }]) {
      const result = material3("#6750a4", generationOptions as unknown as Material3Input).build();

      expectIssueCodes(result, ["material3-invalid-input"]);
      expect(expectIssuePaths(result)).toContain(
        "id" in generationOptions ? "/id" : "/defaultVisibility",
      );
    }
  });

  test("builds every supported dynamic variant", () => {
    for (const variant of material3Variants) {
      const graph = unwrap(
        material3({
          sourceColors: variant === "cmf" ? ["#6750a4", "#00a88f"] : "#6750a4",
          variant,
          specVersion: variant === "cmf" ? "2026" : "2021",
        }).build(),
      );

      expect(
        graph.tokens[variant === "cmf" ? "material3.secondary" : "material3.primary"],
      ).toBeDefined();
      expect(parseTokenGraph(graph).ok).toBe(true);
    }
  });

  test("changes values without changing role keys for a non-default variant", () => {
    const tonalSpot = unwrap(material3({ sourceColors: "#6750a4", specVersion: "2026" }).build());
    const vibrant = unwrap(
      material3({ sourceColors: "#6750a4", variant: "vibrant", specVersion: "2026" }).build(),
    );

    expect(tokenKeys(vibrant)).toEqual(tokenKeys(tonalSpot));
    expect(extractGraphTokenValues(vibrant)).not.toEqual(extractGraphTokenValues(tonalSpot));
  });

  test("uses official CMF behavior for 2026 multi-source input", () => {
    const single = unwrap(
      material3({ sourceColors: "#6750a4", variant: "cmf", specVersion: "2026" }).build(),
    );
    const multi = unwrap(
      material3({
        sourceColors: ["#6750a4", "#00a88f"],
        variant: "cmf",
        specVersion: "2026",
      }).build(),
    );

    expect(tokenKeys(multi)).toEqual(tokenKeys(single));
    expect(extractGraphTokenValues(multi)).not.toEqual(extractGraphTokenValues(single));
  });

  test("rejects CMF when the required 2026 spec version is not selected", () => {
    const result = material3({ sourceColors: "#6750a4", variant: "cmf" }).build();

    expectIssueCodes(result, ["material3-invalid-spec-version"]);
    expect(expectIssuePaths(result)).toContain("/specVersion");
  });

  test("accepts finite contrast levels and rejects invalid values without clamping", () => {
    const defaultContrast = unwrap(material3({ sourceColors: "#6750a4" }).build());
    const highContrast = unwrap(material3({ sourceColors: "#6750a4", contrastLevel: 1 }).build());

    expect(tokenKeys(highContrast)).toEqual(tokenKeys(defaultContrast));
    expect(extractGraphTokenValues(highContrast)).not.toEqual(
      extractGraphTokenValues(defaultContrast),
    );

    for (const contrastLevel of [-1.01, 1.01, Number.NaN, Infinity]) {
      expectIssueCodes(material3({ sourceColors: "#6750a4", contrastLevel }).build(), [
        "material3-invalid-contrast-level",
      ]);
    }
  });

  test("accepts supported spec versions and platforms", () => {
    for (const specVersion of material3SpecVersions) {
      expect(material3({ sourceColors: "#6750a4", specVersion }).build().ok).toBe(true);
    }
    for (const platform of material3Platforms) {
      expect(material3({ sourceColors: "#6750a4", platform }).build().ok).toBe(true);
    }
  });

  test("rejects unsupported variant, spec version, and platform values", () => {
    expect.hasAssertions();

    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        variant: "sprinkles",
      } as unknown as Material3Input).build(),
      ["material3-invalid-variant"],
    );
    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        specVersion: "2030",
      } as unknown as Material3Input).build(),
      ["material3-invalid-spec-version"],
    );
    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        platform: "desktop",
      } as unknown as Material3Input).build(),
      ["material3-invalid-platform"],
    );
  });

  test("applies palette overrides without changing role keys", () => {
    const base = unwrap(material3({ sourceColors: "#6750a4" }).build());
    const overridden = unwrap(
      material3({
        sourceColors: "#6750a4",
        palettes: {
          primary: "#ba1a1a",
          secondary: "#006a60",
          tertiary: "#7d5260",
          neutral: "#605d62",
          neutralVariant: "#605d66",
          error: "#b3261e",
        },
      }).build(),
    );

    expect(tokenKeys(overridden)).toEqual(tokenKeys(base));
    expect(extractGraphTokenValues(overridden)).not.toEqual(extractGraphTokenValues(base));
    expect(extractGraphTokenValues(overridden)["material3.primary"]).not.toEqual(
      extractGraphTokenValues(base)["material3.primary"],
    );
  });

  test("generates extended color roles and preserves description metadata where supported", () => {
    const withDescription = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [
          {
            name: "success",
            color: "#2e7d32",
            harmonize: true,
            description: "Positive state color",
          },
        ],
      }).build(),
    );
    const withoutDescription = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
      }).build(),
    );

    expect(tokenKeys(withDescription)).toEqual(tokenKeys(withoutDescription));
    expect(withDescription.tokens["material3.extended.success.color"]?.description).toBe(
      "Positive state color",
    );
    expect(Object.keys(withDescription.tokens)).toEqual(
      expect.arrayContaining([
        "material3.extended.success.color",
        "material3.extended.success.on-color",
        "material3.extended.success.color-container",
        "material3.extended.success.on-color-container",
      ]),
    );
    expect(parseTokenGraph(withDescription).ok).toBe(true);
  });

  test("keeps harmonize as the canonical extended color behavior switch", () => {
    const harmonized = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
      }).build(),
    );
    const unharmonized = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", color: "#2e7d32", harmonize: false }],
      }).build(),
    );

    expect(extractGraphTokenValuesByPrefix(harmonized, "material3.extended.success.")).not.toEqual(
      extractGraphTokenValuesByPrefix(unharmonized, "material3.extended.success."),
    );
  });

  test("rejects invalid extended colors and stale extended color aliases", () => {
    expect.hasAssertions();

    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        extendedColors: {},
      } as unknown as Material3Input).build(),
      ["material3-invalid-extended-colors"],
    );
    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "Success", color: "#2e7d32" }],
      }).build(),
      ["material3-invalid-extended-color-name"],
    );
    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [
          { name: "success", color: "#2e7d32" },
          { name: "success", color: "#006d43" },
        ],
      }).build(),
      ["material3-duplicate-extended-color-name"],
    );
    expectIssueCodes(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", value: "#2e7d32", blend: true }],
      } as unknown as Material3Input).build(),
      ["material3-unsupported-extended-color-input", "material3-invalid-input"],
    );
  });

  test("emits palette tone tokens only when requested", () => {
    const withoutTones = unwrap(material3({ sourceColors: "#6750a4" }).build());
    const withTones = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", color: "#2e7d32" }],
        paletteTones: [40, 90, 98],
      }).build(),
    );

    expect(Object.keys(withoutTones.tokens).some((key) => key.includes(".palette."))).toBe(false);
    expect(Object.keys(withTones.tokens)).toEqual(
      expect.arrayContaining([
        "material3.palette.primary.tone-40",
        "material3.palette.secondary.tone-90",
        "material3.palette.tertiary.tone-40",
        "material3.palette.neutral.tone-98",
        "material3.palette.neutral-variant.tone-90",
        "material3.palette.error.tone-40",
        "material3.extended.success.palette.tone-40",
      ]),
    );
    expect(parseTokenGraph(withTones).ok).toBe(true);
  });

  test("supports the default material-schemes palette tone list through paletteTones true", () => {
    const graph = unwrap(material3({ sourceColors: "#6750a4", paletteTones: true }).build());
    const paletteToneKeys = Object.keys(graph.tokens).filter((key) =>
      key.startsWith("material3.palette."),
    );

    expect(paletteToneKeys).toHaveLength(6 * 18);
    expect(paletteToneKeys).toContain("material3.palette.primary.tone-0");
    expect(paletteToneKeys).toContain("material3.palette.primary.tone-100");
  });

  test("rejects invalid palette tones", () => {
    expect.hasAssertions();

    expectIssueCodes(material3({ sourceColors: "#6750a4", paletteTones: [-1] }).build(), [
      "material3-invalid-palette-tone",
    ]);
    expectIssueCodes(material3({ sourceColors: "#6750a4", paletteTones: [40, 40] }).build(), [
      "material3-duplicate-palette-tone",
    ]);
  });

  test("emits strict graph schema-compatible lower-kebab namespaced keys", () => {
    const graph = unwrap(
      material3({
        sourceColors: "#6750a4",
        extendedColors: [{ name: "success", color: "#2e7d32" }],
        paletteTones: [40],
      }).build(),
    );
    const ajv = createAjv();
    const validateGraph = ajv.getSchema(
      "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
    );
    if (validateGraph === undefined) {
      throw new Error("Expected root token graph schema to be registered.");
    }

    expect(validateGraph(graph)).toBe(true);
    expect(validateGraph.errors).toBe(null);
    for (const key of Object.keys(graph.tokens)) {
      expect(key).toMatch(
        /^material3\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/,
      );
    }
  });

  test("keeps the adapter engine vendored and package-owned", () => {
    const manifest = readJsonObject(join(process.cwd(), "package.json"));
    const notice = readFileSync(join(process.cwd(), "NOTICE.md"), "utf8");
    const apacheLicense = readFileSync(join(process.cwd(), "LICENSE-APACHE-2.0"), "utf8");

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.private).toBeUndefined();
    expect(manifest.license).toBe("MIT AND Apache-2.0");
    expect(manifest.files).toEqual(
      expect.arrayContaining(["NOTICE.md", "LICENSE", "LICENSE-APACHE-2.0"]),
    );
    expect(manifest.publishConfig).toEqual({ access: "public" });
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.peerDependencies).toEqual({
      "scheme-tokens": "^0.1.0",
    });
    expect(manifest.devDependencies).toEqual({
      "scheme-tokens": "workspace:*",
    });
    expect(JSON.stringify(manifest)).not.toContain("@material/material-color-utilities");
    expect(notice).toContain("material-foundation/material-color-utilities");
    expect(notice).toContain("6fd88eb3e95ba1d457842e2a2bf847d06b3a018a");
    expect(notice).toContain("Apache License, Version 2.0");
    expect(apacheLicense).toContain("TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION");
  });
});

function extractGraphTokenValues(graph: TokenGraphInput): GraphValues {
  const output: Record<string, { readonly light: string; readonly dark: string }> = {};
  for (const [key, definition] of Object.entries(graph.tokens)) {
    const valueByMode = (definition as TokenDefinitionInput<"light" | "dark">).valueByMode;
    if (valueByMode === undefined) {
      throw new Error(`Expected valueByMode for ${key}`);
    }
    output[key] = {
      light: valueByMode.light as string,
      dark: valueByMode.dark as string,
    };
  }
  return output;
}

function extractGraphTokenValuesByPrefix(graph: TokenGraphInput, prefix: string): GraphValues {
  return Object.fromEntries(
    Object.entries(extractGraphTokenValues(graph)).filter(([key]) => key.startsWith(prefix)),
  );
}

function tokenKeys(graph: TokenGraphInput): readonly string[] {
  return Object.keys(graph.tokens).sort();
}

function expectIssueCodes(
  result: Result<unknown, Material3Issue>,
  expectedCodes: readonly Material3Issue["code"][],
): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.issues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining([...expectedCodes]),
  );
}

function expectIssuePaths(result: Result<unknown, Material3Issue>): readonly string[] {
  expect(result.ok).toBe(false);
  return result.ok
    ? []
    : result.issues.flatMap((issue) => (issue.path === undefined ? [] : [issue.path]));
}

function createAjv(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    schemas: [
      readRootSchema("token-graph.v1.schema.json"),
      readRootSchema("token-layer.v1.schema.json"),
      readRootSchema("compiled-scheme.v1.schema.json"),
    ],
  });
}

function readRootSchema(file: string): Record<string, unknown> {
  return readJsonObject(join(process.cwd(), "..", "..", "schemas", file));
}

function readJsonObject(path: string): Record<string, unknown> {
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${path}`);
  }
  return value as Record<string, unknown>;
}

function jsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function expectMaterial3Issue(issue: Material3Issue): Material3Issue {
  return issue;
}

expectMaterial3Issue({
  code: "material3-invalid-source-colors",
  message: "sourceColors is required.",
  field: "sourceColors",
  path: "/sourceColors",
});

expectMaterial3Issue({
  code: "material3-invalid-extended-color-name",
  message: "extended color name must be a lower-kebab single segment.",
  path: "/extendedColors/0/name",
  value: "Success",
});
