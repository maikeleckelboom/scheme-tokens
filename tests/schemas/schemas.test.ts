import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  compiledSchemeKind,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  tokenGraphKind,
  tokenLayerKind,
  type TokenGraphInput,
} from "../../src";

const schemaDirectory = join(process.cwd(), "schemas");
const fixtureDirectory = join(process.cwd(), "tests", "schemas", "fixtures");

const graphSchema = readJsonObject(join(schemaDirectory, "token-graph.v1.schema.json"));
const layerSchema = readJsonObject(join(schemaDirectory, "token-layer.v1.schema.json"));
const compiledSchema = readJsonObject(join(schemaDirectory, "compiled-scheme.v1.schema.json"));

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
      scheme: {
        metadataByToken: {
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
      kind: tokenGraphKind,
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "brand.primary": { value: "#6750a4", visibility: "internal" },
        primary: { value: { ref: "brand.primary" } },
      },
    };
    const layer = {
      kind: tokenLayerKind,
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
      graph: {
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
      layer: {
        tokens: {
          background: { value: { ref: "brand.primary" } },
        },
      },
    });
  });

  test("compiled scheme schema preflight and parser preserve authored CSS strings", () => {
    const ajv = createAjv();
    const compiled = validCompiledWithValue("lab(64 12 -18)");

    expectSchemaValid(ajv, compiledSchema, compiled, "compiled CSS string");
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: true,
      scheme: { tokens: { "brand.primary": { base: "lab(64 12 -18)" } } },
    });
  });

  test("compiled scheme fixture is produced by compileTokenGraph and validates", () => {
    const ajv = createAjv();
    const graph = readFixtureObject("valid", "multi-mode-strict-graph.json");
    const compiledFixture = readFixtureObject("valid", "compiled-scheme.json");
    const compiled = compileTokenGraph(graph as unknown as TokenGraphInput);

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      throw new Error(JSON.stringify(compiled.issues));
    }

    const serialized = JSON.parse(serializeCompiledScheme(compiled.scheme)) as unknown;
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

  test.each([
    {
      label: "undeclared default mode",
      value: {
        ...validGraphWithValue("#ffffff"),
        modes: ["base"],
        defaultMode: "dark",
      },
      code: "default-mode-not-found",
    },
    {
      label: "missing valueByMode coverage",
      value: {
        ...validGraphWithValue("#ffffff"),
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "brand.primary": {
            valueByMode: {
              light: "#ffffff",
            },
          },
        },
      },
      code: "missing-mode-value",
    },
    {
      label: "unknown reference target",
      value: {
        ...validGraphWithValue("#ffffff"),
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

  test("schemas and parsers reject structured values in every artifact", () => {
    const ajv = createAjv();
    const structuredValue = { colorSpace: "srgb", components: [1, 1, 1], alpha: 1 };
    const graph = validGraphWithValue(structuredValue);
    const layer = validLayerWithValue(structuredValue);
    const compiled = validCompiledWithValue(structuredValue);

    expectSchemaInvalid(ajv, graphSchema, graph, "graph structured value");
    expect(parseTokenGraph(graph)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value" }],
    });
    expectSchemaInvalid(ajv, layerSchema, layer, "layer structured value");
    expect(parseTokenLayer(layer)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value" }],
    });
    expectSchemaInvalid(ajv, compiledSchema, compiled, "compiled structured value");
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value" }],
    });
  });

  test("compiled metadata rejects source origins and invalid dependencies", () => {
    const ajv = createAjv();
    const sourceOrigin = validCompiledWithValue("#ffffff");
    sourceOrigin.metadataByToken["brand.primary"]!.origin = { kind: "source", id: "material" };
    const invalidDependency = validCompiledWithValue("#ffffff");
    invalidDependency.metadataByToken["brand.primary"]!.dependenciesByMode.base = ["Bad Key"];

    expectSchemaInvalid(ajv, compiledSchema, sourceOrigin, "compiled source origin");
    expect(parseCompiledScheme(sourceOrigin)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-origin" }],
    });
    expectSchemaInvalid(ajv, compiledSchema, invalidDependency, "compiled invalid dependency");
    expect(parseCompiledScheme(invalidDependency)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-dependencies" }],
    });
  });

  test("unknown safe extension keys and values round-trip through parsers", () => {
    const ajv = createAjv();
    const unusualExtensions = JSON.parse(
      '{"UPSTREAM vendor/key":{"safe":true},"__proto__":{"polluted":true}," spaced key ":["value",1,null]}',
    ) as Record<string, unknown>;
    const graph = validGraphWithValue("#ffffff");
    graph.tokens["brand.primary"]!.extensions = unusualExtensions;
    const layer = validLayerWithValue("#ffffff");
    layer.tokens["brand.primary"]!.extensions = unusualExtensions;
    const compiled = validCompiledWithValue("#ffffff");
    compiled.metadataByToken["brand.primary"]!.extensions = unusualExtensions;

    expectSchemaValid(ajv, graphSchema, graph, "graph unusual extensions");
    expectSchemaValid(ajv, layerSchema, layer, "layer unusual extensions");
    expectSchemaValid(ajv, compiledSchema, compiled, "compiled unusual extensions");
    expect(
      expectParseTokenGraphOk(graph, "graph unusual extensions").tokens["brand.primary"]
        ?.extensions,
    ).toEqual(unusualExtensions);
    expect(parseTokenLayer(layer)).toMatchObject({
      ok: true,
      layer: { tokens: { "brand.primary": { extensions: unusualExtensions } } },
    });
    expect(parseCompiledScheme(compiled)).toMatchObject({
      ok: true,
      scheme: { metadataByToken: { "brand.primary": { extensions: unusualExtensions } } },
    });
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test.each([
    {
      label: "missing graph kind",
      value: withoutProperty(validGraphWithValue("#ffffff"), "kind"),
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "missing-property",
    },
    {
      label: "wrong graph kind",
      value: {
        ...validGraphWithValue("#ffffff"),
        kind: tokenLayerKind,
      },
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-artifact-kind",
    },
    {
      label: "compiled passed as graph",
      value: validCompiledWithValue("#ffffff"),
      schema: graphSchema,
      parse: parseTokenGraph,
      code: "invalid-artifact-kind",
    },
    {
      label: "missing compiled metadata",
      value: withoutProperty(validCompiledWithValue("#ffffff"), "metadataByToken"),
      schema: compiledSchema,
      parse: parseCompiledScheme,
      code: "missing-property",
    },
    {
      label: "graph passed as compiled scheme",
      value: validGraphWithValue("#ffffff"),
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

function validGraphWithValue(value: unknown): {
  kind: string;
  formatVersion: number;
  modes: string[];
  defaultMode: string;
  defaultVisibility: string;
  tokens: Record<string, { value: unknown; extensions?: unknown }>;
} {
  return {
    kind: tokenGraphKind,
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens: {
      "brand.primary": { value },
    },
  };
}

function validLayerWithValue(value: unknown): {
  kind: string;
  formatVersion: number;
  id: string;
  defaultVisibility: string;
  tokens: Record<string, { value: unknown; extensions?: unknown }>;
} {
  return {
    kind: tokenLayerKind,
    formatVersion: 1,
    id: "brand",
    defaultVisibility: "public",
    tokens: {
      "brand.primary": { value },
    },
  };
}

function validCompiledWithValue(value: unknown): {
  kind: string;
  formatVersion: number;
  modes: string[];
  defaultMode: string;
  tokens: Record<string, Record<string, unknown>>;
  metadataByToken: Record<
    string,
    {
      visibility: string;
      origin: { kind: string; id?: string };
      dependenciesByMode: Record<string, string[]>;
      extensions?: unknown;
    }
  >;
} {
  return {
    kind: compiledSchemeKind,
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    tokens: {
      "brand.primary": { base: value },
    },
    metadataByToken: {
      "brand.primary": {
        visibility: "public",
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

function expectParseTokenGraphOk(graph: unknown, label: string): TokenGraphInput {
  const parsed = parseTokenGraph(graph);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(`${label}: ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.graph;
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
