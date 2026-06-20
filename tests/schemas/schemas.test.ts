import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import { compileTokenGraph, parseTokenGraph, serializeScheme, type TokenGraph } from "../../src";

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
    expect(parsed.tokens["card.background"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

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

    const serialized = JSON.parse(serializeScheme(compiled.value)) as unknown;
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
        formatVersion: 1,
        modes: ["base"],
        defaultMode: "base",
        defaultVisibility: "public",
        tokens: {
          [key]: { value: "#ffffff" },
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

function expectParseTokenGraphOk(graph: unknown, label: string): TokenGraph {
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
