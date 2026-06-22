import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  colorTokenGraphKind,
  colorTokenLayerKind,
  compiledColorSchemeKind,
  compileTokenGraph,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  type ColorTokenGraphInput,
} from "../../src";

const schemaDirectory = join(process.cwd(), "schemas");
const fixtureDirectory = join(process.cwd(), "tests", "schemas", "fixtures");

const graphSchema = readJsonObject(join(schemaDirectory, "color-token-graph.v1.schema.json"));
const layerSchema = readJsonObject(join(schemaDirectory, "color-token-layer.v1.schema.json"));
const compiledSchema = readJsonObject(
  join(schemaDirectory, "compiled-color-scheme.v1.schema.json"),
);

const strictGraphFixtureFiles = [
  "single-mode-strict-graph.json",
  "multi-mode-strict-graph.json",
] as const;

const invalidGraphFixtureFiles = [
  "raw-color-string-token-definition.json",
  "raw-reference-token-definition.json",
  "mode-record-token-definition.json",
  "omitted-format-version.json",
  "omitted-modes.json",
  "omitted-default-mode.json",
  "omitted-default-visibility.json",
  "unexpected-top-level-property.json",
] as const;

describe("JSON Schemas", () => {
  test.each(strictGraphFixtureFiles)(
    "%s validates as strict graph input and parses",
    (fixtureFile) => {
      expect.hasAssertions();

      const ajv = createAjv();
      const graph = readFixtureObject("valid", fixtureFile);

      expectSchemaValid(ajv, graphSchema, graph, fixtureFile);
      expectParseTokenGraphOk(graph, fixtureFile);
    },
  );

  test("layer input validates and parses when embedded in a graph", () => {
    const ajv = createAjv();
    const graph = readFixtureObject("valid", "multi-mode-strict-graph.json");
    const layer = readFixtureObject("valid", "token-layer.json");
    const graphWithLayer = { ...graph, layers: [layer] };

    expectSchemaValid(ajv, layerSchema, layer, "token-layer.json");
    expectSchemaValid(ajv, graphSchema, graphWithLayer, "graph with layer");

    const parsed = expectParseTokenGraphOk(graphWithLayer, "graph with layer");
    expect(parsed.layers?.[0]?.tokens["card.background"]?.value).toEqual({ ref: "brand.primary" });
    const compiled = compileTokenGraph(parsed, { selection: "all" });
    expect(compiled).toMatchObject({
      ok: true,
      value: {
        tokens: {
          "card.background": {
            origin: {
              kind: "layer",
              id: "application",
            },
          },
        },
      },
    });
  });

  test("graph and layer schemas accept strict token references", () => {
    const ajv = createAjv();
    const graph = {
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "brand.primary": { value: srgb(0.4, 0.31, 0.64), visibility: "internal" },
        primary: { value: { ref: "brand.primary" } },
      },
    };
    const layer = {
      kind: colorTokenLayerKind,
      formatVersion: 1,
      id: "application",
      defaultVisibility: "public",
      tokens: {
        background: { value: { ref: "brand.primary" } },
      },
    };

    expectSchemaValid(ajv, graphSchema, graph, "graph token references");
    expect(parseTokenGraph(graph)).toMatchObject({
      ok: true,
      value: {
        tokens: {
          primary: {
            value: { ref: "brand.primary" },
          },
        },
      },
    });
    expectSchemaValid(ajv, layerSchema, layer, "layer token references");
    expect(parseTokenLayer(layer)).toMatchObject({
      ok: true,
      value: {
        tokens: {
          background: { value: { ref: "brand.primary" } },
        },
      },
    });
  });

  test("parser rejects removed token-lane fields", () => {
    const removedField = `semantic${"Tokens"}`;
    const graph = {
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {},
      [removedField]: {
        primary: { value: { ref: "brand.primary" } },
      },
    };

    expect(parseTokenGraph(graph)).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-property", path: `/${removedField}` }],
    });
  });

  test("compiled scheme parser rejects removed token-lane origins", () => {
    const removedOriginKind = `semantic${"Token"}`;
    const compiled = validCompiledWithColor(srgb(1, 1, 1));
    compiled.tokens["brand.primary"]!.origin = {
      kind: removedOriginKind,
      origin: { kind: "graph" },
      target: "brand.primary",
    } as never;

    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin", path: "/tokens/brand.primary/origin" }],
    });
  });

  test("graph and layer schemas reject removed token-lane fields", () => {
    expect.hasAssertions();

    const ajv = createAjv();
    const removedField = `semantic${"Tokens"}`;
    const graph = {
      kind: colorTokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "internal",
      tokens: {
        "brand.primary": { value: srgb(0.4, 0.31, 0.64) },
      },
      [removedField]: {
        primary: { value: { ref: "brand.primary" } },
      },
    };
    const layer = {
      kind: colorTokenLayerKind,
      formatVersion: 1,
      id: "application",
      defaultVisibility: "internal",
      tokens: {},
      [removedField]: {
        background: { value: { ref: "brand.primary" } },
      },
    };

    expectSchemaInvalid(ajv, graphSchema, graph, "graph removed token-lane field");
    expectSchemaInvalid(ajv, layerSchema, layer, "layer removed token-lane field");
  });

  test("token graph schema preflight and parser accept structured persisted colors", () => {
    expect.hasAssertions();

    const ajv = createAjv();
    const graph = validGraphWithColor({
      colorSpace: "oklch",
      components: [0.7, 0.12, 265],
      alpha: 1,
    });

    expectSchemaValid(ajv, graphSchema, graph, "structured graph color");
    expectParseTokenGraphOk(graph, "structured graph color");
  });

  test("token layer schema preflight and parser accept structured persisted colors", () => {
    const ajv = createAjv();
    const layer = validLayerWithColor({
      colorSpace: "display-p3",
      components: [0.9, 0.3, 0.1],
      alpha: 0.8,
    });

    expectSchemaValid(ajv, layerSchema, layer, "structured layer color");
    expect(parseTokenLayer(layer).ok).toBe(true);
  });

  test("compiled scheme schema preflight and parser accept structured persisted colors", () => {
    const ajv = createAjv();
    const compiled = validCompiledWithColor({
      colorSpace: "lab",
      components: [64, 12, -18],
      alpha: 1,
    });

    expectSchemaValid(ajv, compiledSchema, compiled, "structured compiled color");
    expect(parseCompiledScheme(compiled).ok).toBe(true);
  });

  test.each([
    {
      label: "undeclared default mode",
      value: {
        ...validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        modes: ["base"],
        defaultMode: "dark",
      },
      code: "default-mode-not-found",
    },
    {
      label: "missing valueByMode coverage",
      value: {
        ...validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "brand.primary": {
            valueByMode: {
              light: { colorSpace: "srgb", components: [1, 1, 1], alpha: 1 },
            },
          },
        },
      },
      code: "missing-mode-value",
    },
    {
      label: "unknown reference target",
      value: {
        ...validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        tokens: {
          "brand.alias": {
            value: { ref: "brand.missing" },
          },
        },
      },
      code: "unknown-reference",
    },
  ] as const)("schema-valid graph can still be parser-invalid: $label", ({ value, code }) => {
    const ajv = createAjv();

    expectSchemaValid(ajv, graphSchema, value, "schema-valid parser-invalid graph");
    expect(parseTokenGraph(value)).toMatchObject({ ok: false, issues: [{ code }] });
  });

  test.each([
    {
      label: "invalid string color",
      color: "#ffffff",
      code: "unsupported-color-syntax",
    },
    {
      label: "invalid color space",
      color: { colorSpace: "unknown-rgb", components: [1, 1, 1], alpha: 1 },
      code: "invalid-color-space",
    },
    {
      label: "invalid component count",
      color: { colorSpace: "srgb", components: [1, 1], alpha: 1 },
      code: "invalid-color-components",
    },
    {
      label: "invalid alpha",
      color: { colorSpace: "srgb", components: [1, 1, 1], alpha: 1.2 },
      code: "invalid-color-alpha",
    },
    {
      label: "out-of-range hsl percentage",
      color: { colorSpace: "hsl", components: [270, 101, 50], alpha: 1 },
      code: "invalid-color-component",
    },
    {
      label: "negative oklch chroma",
      color: { colorSpace: "oklch", components: [0.7, -0.01, 265], alpha: 1 },
      code: "invalid-color-component",
    },
    {
      label: "invalid hex fallback",
      color: { colorSpace: "srgb", components: [1, 1, 1], alpha: 1, hex: "#fff" },
      code: "invalid-color-hex",
    },
  ] as const)("schemas and parsers reject $label in every color artifact", ({ color, code }) => {
    const ajv = createAjv();
    const graph = validGraphWithColor(color);
    const layer = validLayerWithColor(color);
    const compiled = validCompiledWithColor(color);

    expectSchemaInvalid(ajv, graphSchema, graph, "graph invalid color");
    expect(parseTokenGraph(graph)).toMatchObject({ ok: false, issues: [{ code }] });
    expectSchemaInvalid(ajv, layerSchema, layer, "layer invalid color");
    expect(parseTokenLayer(layer)).toMatchObject({ ok: false, issues: [{ code }] });
    expectSchemaInvalid(ajv, compiledSchema, compiled, "compiled invalid color");
    expect(parseCompiledScheme(compiled)).toMatchObject({ ok: false, issues: [{ code }] });
  });

  test("schemas and parsers reject invalid reference-bearing fields", () => {
    const ajv = createAjv();
    const graph = validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 });
    graph.tokens["brand.alias"] = { value: { ref: "Bad Key" } };
    const layer = validLayerWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 });
    layer.tokens["brand.alias"] = { value: { ref: "Bad Key" } };
    const compiled = validCompiledWithColor({
      colorSpace: "srgb",
      components: [1, 1, 1],
      alpha: 1,
    });
    compiled.tokens["brand.primary"]!.dependenciesByMode.base = ["Bad Key"];

    expectSchemaInvalid(ajv, graphSchema, graph, "graph invalid ref");
    expect(parseTokenGraph(graph)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-reference" }],
    });
    expectSchemaInvalid(ajv, layerSchema, layer, "layer invalid ref");
    expect(parseTokenLayer(layer)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-reference" }],
    });
    expectSchemaInvalid(ajv, compiledSchema, compiled, "compiled invalid dependency");
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-dependencies" }],
    });
  });

  test("unknown safe extension keys and values round-trip through parsers", () => {
    const ajv = createAjv();
    const unusualExtensions = JSON.parse(
      '{"UPSTREAM vendor/key":{"safe":true},"__proto__":{"polluted":true}," spaced key ":["value",1,null]}',
    ) as Record<string, unknown>;
    const graph = validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 });
    graph.tokens["brand.primary"]!.extensions = unusualExtensions;
    const layer = validLayerWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 });
    layer.tokens["brand.primary"]!.extensions = unusualExtensions;
    const compiled = validCompiledWithColor({
      colorSpace: "srgb",
      components: [1, 1, 1],
      alpha: 1,
    });
    compiled.tokens["brand.primary"]!.extensions = unusualExtensions;

    expectSchemaValid(ajv, graphSchema, graph, "graph unusual extensions");
    expectSchemaValid(ajv, layerSchema, layer, "layer unusual extensions");
    expectSchemaValid(ajv, compiledSchema, compiled, "compiled unusual extensions");
    const parsedGraph = expectParseTokenGraphOk(graph, "graph unusual extensions");
    const parsedLayer = parseTokenLayer(layer);
    const parsedCompiled = parseCompiledScheme(compiled);

    expect(parsedGraph.tokens["brand.primary"]?.extensions).toEqual(unusualExtensions);
    expect(parsedLayer).toMatchObject({
      ok: true,
      value: { tokens: { "brand.primary": { extensions: unusualExtensions } } },
    });
    expect(parsedCompiled).toMatchObject({
      ok: true,
      value: { tokens: { "brand.primary": { extensions: unusualExtensions } } },
    });
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test("runtime parsers reject sparse arrays, accessors, and unsafe extension values without weakening JSON hardening", () => {
    const sparseComponents = [1, undefined, 1];
    delete sparseComponents[1];
    const sparseGraph = validGraphWithColor({
      colorSpace: "srgb",
      components: sparseComponents,
      alpha: 1,
    });
    expect(parseTokenGraph(sparseGraph)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-color-components" }],
    });

    const accessorColor = {};
    Object.defineProperty(accessorColor, "colorSpace", {
      enumerable: true,
      get() {
        throw new Error("getter should not run");
      },
    });
    expect(parseTokenLayer(validLayerWithColor(accessorColor))).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-color-input" }],
    });

    const accessorExtension = {};
    Object.defineProperty(accessorExtension, "value", {
      enumerable: true,
      get() {
        throw new Error("extension getter should not run");
      },
    });
    const graph = validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 });
    graph.tokens["brand.primary"]!.extensions = { "foreign/key": accessorExtension };
    expect(parseTokenGraph(graph)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-json-value" }],
    });
  });

  test.each([
    {
      label: "missing graph kind",
      value: withoutProperty(
        validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        "kind",
      ),
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "missing-property",
    },
    {
      label: "wrong graph kind",
      value: {
        ...validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        kind: colorTokenLayerKind,
      },
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-artifact-kind",
    },
    {
      label: "wrong graph format version",
      value: {
        ...validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        formatVersion: 2,
      },
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-format-version",
    },
    {
      label: "layer passed as graph",
      value: validLayerWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-artifact-kind",
    },
    {
      label: "compiled passed as graph",
      value: validCompiledWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-artifact-kind",
    },
    {
      label: "missing compiled kind",
      value: withoutProperty(
        validCompiledWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        "kind",
      ),
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "missing-property",
    },
    {
      label: "wrong compiled format version",
      value: {
        ...validCompiledWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        formatVersion: 2,
      },
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "invalid-format-version",
    },
    {
      label: "missing compiled modes",
      value: withoutProperty(
        validCompiledWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        "modes",
      ),
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "missing-property",
    },
    {
      label: "missing compiled tokens",
      value: withoutProperty(
        validCompiledWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
        "tokens",
      ),
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "missing-property",
    },
    {
      label: "graph passed as compiled scheme",
      value: validGraphWithColor({ colorSpace: "srgb", components: [1, 1, 1], alpha: 1 }),
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "invalid-artifact-kind",
    },
  ] as const)(
    "schemas and parsers reject artifact identity mismatch: $label",
    ({ value, schema, parse, code }) => {
      expect.hasAssertions();

      const ajv = createAjv();

      expectSchemaInvalid(ajv, schema, value, "artifact identity mismatch");
      expectIssueCode(parse(value), code);
    },
  );

  test("strict graph schema and parser reject old layer collection field", () => {
    const ajv = createAjv();
    const graph = readFixtureObject("valid", "multi-mode-strict-graph.json");
    const layer = readFixtureObject("valid", "token-layer.json");
    const oldField = `frag${"ments"}`;
    const graphWithOldField = { ...graph, [oldField]: [layer] };

    expectSchemaInvalid(ajv, graphSchema, graphWithOldField, "graph with old layer collection");
    expect(parseTokenGraph(graphWithOldField)).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-property", path: `/${oldField}` }],
    });
  });

  test("compiled scheme fixture is produced by compileTokenGraph and validates", () => {
    const ajv = createAjv();
    const graph = readFixtureObject("valid", "multi-mode-strict-graph.json");
    const compiledFixture = readFixtureObject("valid", "compiled-scheme.json");
    const compiled = compileTokenGraph(graph);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error(JSON.stringify(compiled.issues));
    }

    const serialized = JSON.parse(serializeCompiledScheme(compiled.value)) as unknown;
    expect(serialized).toEqual(compiledFixture);
    expectSchemaValid(ajv, compiledSchema, serialized, "compiled output");
  });

  test.each(invalidGraphFixtureFiles)(
    "%s is rejected by the graph schema and parser",
    (fixtureFile) => {
      const ajv = createAjv();
      const graph = readFixtureObject("invalid", fixtureFile);

      expectSchemaInvalid(ajv, graphSchema, graph, fixtureFile);
      expect(parseTokenGraph(graph).ok).toBe(false);
    },
  );

  test.each(["camelCase", "snake_case", "PascalCase", "with space", "brand.mixedCase"])(
    "strict graph schema and parser reject non-canonical token key %s",
    (key) => {
      const ajv = createAjv();
      const graph = {
        kind: colorTokenGraphKind,
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          [key]: { value: srgb(1, 1, 1) },
        },
      };

      expectSchemaInvalid(ajv, graphSchema, graph, `graph with token key ${key}`);
      expect(parseTokenGraph(graph)).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-token-key", path: `/tokens/${key}` }],
      });
    },
  );

  test("compiled scheme schema rejects unresolved authoring color strings", () => {
    expect.hasAssertions();

    const ajv = createAjv();
    const compiledFixture = readFixtureObject("valid", "compiled-scheme.json");
    const unresolvedCompiled = {
      ...compiledFixture,
      tokens: {
        "button.background": {
          visibility: "public",
          valueByMode: {
            light: "#6750a4",
            dark: "#d0bcff",
          },
          origin: {
            kind: "graph",
          },
          dependenciesByMode: {
            light: ["brand.primary"],
            dark: ["brand.primary"],
          },
        },
      },
    };

    expectSchemaInvalid(ajv, compiledSchema, unresolvedCompiled, "compiled authoring strings");
    expectIssueCode(parseCompiledScheme(unresolvedCompiled), "unsupported-color-syntax");
  });
});

function createAjv(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    schemas: [graphSchema, layerSchema, compiledSchema],
  });
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function readJsonObject(path: string): Record<string, unknown> {
  const value = readJson(path);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected JSON object: ${path}`);
  }
  return value as Record<string, unknown>;
}

function readFixtureObject(
  status: "valid" | "invalid",
  fixtureFile: string,
): Record<string, unknown> {
  return readJsonObject(join(fixtureDirectory, status, fixtureFile));
}

function srgb(red: number, green: number, blue: number): Record<string, unknown> {
  return { colorSpace: "srgb", components: [red, green, blue], alpha: 1 };
}

function validGraphWithColor(color: unknown): {
  kind: string;
  formatVersion: number;
  modes: string[];
  defaultMode: string;
  defaultVisibility: string;
  tokens: Record<string, { value: unknown; extensions?: unknown }>;
} {
  return {
    kind: colorTokenGraphKind,
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens: {
      "brand.primary": { value: color },
    },
  };
}

function validLayerWithColor(color: unknown): {
  kind: string;
  formatVersion: number;
  id: string;
  defaultVisibility: string;
  tokens: Record<string, { value: unknown; extensions?: unknown }>;
} {
  return {
    kind: colorTokenLayerKind,
    formatVersion: 1,
    id: "brand",
    defaultVisibility: "public",
    tokens: {
      "brand.primary": { value: color },
    },
  };
}

function validCompiledWithColor(color: unknown): {
  kind: string;
  formatVersion: number;
  modes: string[];
  defaultMode: string;
  tokens: Record<
    string,
    {
      visibility: string;
      valueByMode: Record<string, unknown>;
      origin: { kind: string };
      dependenciesByMode: Record<string, string[]>;
      extensions?: unknown;
    }
  >;
} {
  return {
    kind: compiledColorSchemeKind,
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    tokens: {
      "brand.primary": {
        visibility: "public",
        valueByMode: { base: color },
        origin: { kind: "graph" },
        dependenciesByMode: { base: [] },
      },
    },
  };
}

function withoutProperty<T extends Record<string, unknown>>(
  input: T,
  key: string,
): Record<string, unknown> {
  const copy = { ...input };
  delete copy[key];
  return copy;
}

function expectParseTokenGraphOk(graph: unknown, label: string): ColorTokenGraphInput {
  const parsed = parseTokenGraph(graph);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(`${label}: ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.value;
}

function expectSchemaValid(
  ajv: Ajv2020,
  schema: boolean | object,
  value: unknown,
  label: string,
): void {
  const valid = ajv.validate(schema, value);
  if (!valid) {
    throw new Error(`${label}: ${JSON.stringify(ajv.errors)}`);
  }
  expect(ajv.errors).toBe(null);
  expect(valid).toBe(true);
}

function expectSchemaInvalid(
  ajv: Ajv2020,
  schema: boolean | object,
  value: unknown,
  label: string,
): void {
  if (ajv.validate(schema, value)) {
    throw new Error(`${label}: schema unexpectedly accepted fixture`);
  }
  expect(ajv.errors).not.toBe(null);
}

function expectIssueCode(
  result: { readonly ok: boolean; readonly issues?: readonly { readonly code: string }[] },
  code: string,
): void {
  expect(result.ok).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({ code }));
}
