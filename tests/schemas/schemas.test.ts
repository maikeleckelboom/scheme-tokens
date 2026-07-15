import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
  serializeTokenLayer,
} from "../../src";

const graphSchemaUri = "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json";
const layerSchemaUri = "https://scheme-tokens.dev/schemas/token-layer.v1.schema.json";
const compiledSchemaUri = "https://scheme-tokens.dev/schemas/compiled-scheme.v1.schema.json";
const reservedModeNames = [
  "ref",
  "value",
  "valueByMode",
  "visibility",
  "description",
  "deprecated",
  "extensions",
] as const;

const schemaDirectory = join(process.cwd(), "schemas");
const fixtureDirectory = join(process.cwd(), "tests", "schemas", "fixtures");

const graphSchema = readJsonObject(join(schemaDirectory, "token-graph.v1.schema.json"));
const layerSchema = readJsonObject(join(schemaDirectory, "token-layer.v1.schema.json"));
const compiledSchema = readJsonObject(join(schemaDirectory, "compiled-scheme.v1.schema.json"));

const strictGraphFixtureFiles = [
  "single-mode-strict-graph.json",
  "multi-mode-strict-graph.json",
  "numeric-scale-token-keys.json",
] as const;

const invalidGraphFixtureFiles = [
  "mode-record-token-definition.json",
  "non-canonical-schema-uri.json",
  "omitted-default-mode.json",
  "omitted-default-visibility.json",
  "omitted-format-version.json",
  "omitted-modes.json",
  "raw-color-string-token-definition.json",
  "raw-reference-token-definition.json",
  "reserved-mode-name.json",
  "unexpected-top-level-property.json",
  "unsupported-format-version.json",
  "value-by-mode-token-definition.json",
] as const;

describe("JSON Schemas", () => {
  test.each(strictGraphFixtureFiles)(
    "%s validates as strict graph input and parses",
    (fixtureFile) => {
      expect.hasAssertions();
      const ajv = createAjv();
      const graph = readFixtureObject("valid", fixtureFile);

      expectSchemaValid(ajv, graphSchema, graph, fixtureFile);
      expectResultOk(parseTokenGraph(graph), fixtureFile);
    },
  );

  test("numeric scale segments remain valid token keys and reference targets", () => {
    const ajv = createAjv();
    const graph = expectResultOk(
      parseTokenGraph(readFixtureObject("valid", "numeric-scale-token-keys.json")),
      "numeric scale graph",
    );
    const compiled = expectResultOk(compileTokenGraph(graph), "numeric scale compilation");

    expect(compiled.tokens.primary?.base).toBe("oklch(62% 0.18 250)");
    expect(compiled.metadataByToken.primary?.dependenciesByMode.base).toEqual(["brand.600"]);

    const numericFirstSegment = {
      ...validGraphWithValue("#6750a4"),
      tokens: { "600.brand": { value: "#6750a4" } },
    };
    expectSchemaInvalid(ajv, graphSchema, numericFirstSegment, "numeric first token segment");
    expectIssueCode(parseTokenGraph(numericFirstSegment), "invalid-token-key");
  });

  test("layer input validates and parses when embedded in a graph", () => {
    const ajv = createAjv();
    const graph = readFixtureObject("valid", "multi-mode-strict-graph.json");
    const layer = readFixtureObject("valid", "token-layer.json");
    const graphWithLayer = { ...graph, layers: [layer] };

    expectSchemaValid(ajv, layerSchema, layer, "token-layer.json");
    expectSchemaValid(ajv, graphSchema, graphWithLayer, "graph with layer");

    const parsed = expectResultOk(parseTokenGraph(graphWithLayer), "graph with layer");
    expect(parsed.layers?.[0]?.tokens["card.background"]?.value).toEqual({
      ref: "brand.primary",
    });
    const compiled = expectResultOk(
      compileTokenGraph(parsed, { selection: "all" }),
      "graph with layer compilation",
    );
    expect(compiled.metadataByToken["card.background"]?.origin).toEqual({
      kind: "layer",
      id: "application",
    });
  });

  test("graph and layer schemas accept exact strict token references", () => {
    const ajv = createAjv();
    const graph = {
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "brand.600": { value: "#6750a4", visibility: "internal" },
        primary: { value: { ref: "brand.600" } },
      },
    };
    const layer = {
      kind: "scheme-tokens/token-layer",
      formatVersion: 1,
      id: "application",
      defaultVisibility: "public",
      tokens: {
        background: { value: { ref: "brand.600" } },
      },
    };

    expectSchemaValid(ajv, graphSchema, graph, "graph token references");
    expect(expectResultOk(parseTokenGraph(graph), "graph token references")).toMatchObject({
      tokens: { primary: { value: { ref: "brand.600" } } },
    });
    expectSchemaValid(ajv, layerSchema, layer, "layer token references");
    expect(expectResultOk(parseTokenLayer(layer), "layer token references")).toMatchObject({
      tokens: { background: { value: { ref: "brand.600" } } },
    });
  });

  test("compiled scheme schema and parser preserve authored CSS strings", () => {
    const ajv = createAjv();
    const compiled = validCompiledWithValue("lab(64 12 -18)");

    expectSchemaValid(ajv, compiledSchema, compiled, "compiled CSS string");
    expect(expectResultOk(parseCompiledScheme(compiled), "compiled CSS string")).toMatchObject({
      tokens: { "brand.600": { base: "lab(64 12 -18)" } },
    });
  });

  test("compiled scheme fixture is produced by compileTokenGraph and validates", () => {
    const ajv = createAjv();
    const graph = expectResultOk(
      parseTokenGraph(readFixtureObject("valid", "multi-mode-strict-graph.json")),
      "multi-mode fixture",
    );
    const compiledFixture = readFixtureObject("valid", "compiled-scheme.json");
    const compiled = expectResultOk(compileTokenGraph(graph), "fixture compilation");

    const serialized = JSON.parse(serializeCompiledScheme(compiled)) as unknown;
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

  test("unsupported versions, old valueByMode, and non-canonical schema URIs have precise issues", () => {
    expect.hasAssertions();
    expectIssueCode(
      parseTokenGraph(readFixtureObject("invalid", "unsupported-format-version.json")),
      "invalid-format-version",
    );
    expectIssueCode(
      parseTokenGraph(readFixtureObject("invalid", "value-by-mode-token-definition.json")),
      "unknown-property",
    );
    expectIssueCode(
      parseTokenGraph(readFixtureObject("invalid", "non-canonical-schema-uri.json")),
      "invalid-schema-uri",
    );
    expectIssueCode(
      parseTokenGraph(readFixtureObject("invalid", "reserved-mode-name.json")),
      "invalid-mode-key",
    );
  });

  test.each(reservedModeNames)("%s is rejected as a reserved graph mode", (mode) => {
    expect.hasAssertions();
    const ajv = createAjv();
    const graph = {
      ...validGraphWithValue("#ffffff"),
      modes: [mode],
      defaultMode: mode,
    };

    expectSchemaInvalid(ajv, graphSchema, graph, `reserved mode ${mode}`);
    expectIssueCode(parseTokenGraph(graph), "invalid-mode-key");
  });

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
      label: "missing mode-map coverage",
      value: {
        ...validGraphWithValue("#ffffff"),
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          "brand.600": {
            value: {
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
    expect.hasAssertions();
    const ajv = createAjv();

    expectSchemaValid(ajv, graphSchema, value, "schema-valid parser-invalid graph");
    expectIssueCode(parseTokenGraph(value), code);
  });

  test("strict token values reject empty maps and non-exact references", () => {
    const ajv = createAjv();
    const emptyMap = validGraphWithValue({});
    const referenceWithExtraProperty = validGraphWithValue({
      ref: "brand.600",
      description: "not part of a reference",
    });

    expectSchemaInvalid(ajv, graphSchema, emptyMap, "empty mode map");
    expect(parseTokenGraph(emptyMap).ok).toBe(false);
    expectSchemaInvalid(ajv, graphSchema, referenceWithExtraProperty, "non-exact reference");
    expect(parseTokenGraph(referenceWithExtraProperty).ok).toBe(false);
  });

  test("layers cannot declare a mode envelope", () => {
    expect.hasAssertions();
    const ajv = createAjv();
    const layer = {
      ...validLayerWithValue("#ffffff"),
      modes: ["light", "dark"],
      defaultMode: "light",
    };

    expectSchemaInvalid(ajv, layerSchema, layer, "layer mode envelope");
    expectIssueCode(parseTokenLayer(layer), "unknown-property");
  });

  test("every optional $schema field accepts only its artifact canonical URL", () => {
    expect.hasAssertions();
    const ajv = createAjv();
    const graph = { ...validGraphWithValue("#ffffff"), $schema: graphSchemaUri };
    const layer = { ...validLayerWithValue("#ffffff"), $schema: layerSchemaUri };
    const compiled = {
      ...validCompiledWithValue("#ffffff"),
      $schema: compiledSchemaUri,
    };

    expectSchemaValid(ajv, graphSchema, graph, "canonical graph schema URI");
    expectSchemaValid(ajv, layerSchema, layer, "canonical layer schema URI");
    expectSchemaValid(ajv, compiledSchema, compiled, "canonical compiled schema URI");
    expectResultOk(parseTokenGraph(graph), "canonical graph schema URI");
    expectResultOk(parseTokenLayer(layer), "canonical layer schema URI");
    expectResultOk(parseCompiledScheme(compiled), "canonical compiled schema URI");

    const wrongLayerSchema = { ...layer, $schema: graphSchemaUri };
    const wrongCompiledSchema = { ...compiled, $schema: graphSchemaUri };
    expectSchemaInvalid(ajv, layerSchema, wrongLayerSchema, "wrong layer schema URI");
    expectSchemaInvalid(ajv, compiledSchema, wrongCompiledSchema, "wrong compiled schema URI");
    expectIssueCode(parseTokenLayer(wrongLayerSchema), "invalid-schema-uri");
    expectIssueCode(parseCompiledScheme(wrongCompiledSchema), "invalid-schema-uri");
  });

  test("schemas and parsers reject structured values in every artifact", () => {
    const ajv = createAjv();
    const structuredValue = { colorSpace: "srgb", components: [1, 1, 1], alpha: 1 };
    const graph = validGraphWithValue(structuredValue);
    const layer = validLayerWithValue(structuredValue);
    const compiled = validCompiledWithValue(structuredValue);

    expectSchemaInvalid(ajv, graphSchema, graph, "graph structured value");
    expect(parseTokenGraph(graph).ok).toBe(false);
    expectSchemaInvalid(ajv, layerSchema, layer, "layer structured value");
    expect(parseTokenLayer(layer).ok).toBe(false);
    expectSchemaInvalid(ajv, compiledSchema, compiled, "compiled structured value");
    expectIssueCode(parseCompiledScheme(compiled), "invalid-token-value");
  });

  test("compiled metadata rejects source origins and invalid dependencies", () => {
    expect.hasAssertions();
    const ajv = createAjv();
    const sourceOrigin = validCompiledWithValue("#ffffff");
    sourceOrigin.metadataByToken["brand.600"]!.origin = { kind: "source", id: "generator" };
    const invalidDependency = validCompiledWithValue("#ffffff");
    invalidDependency.metadataByToken["brand.600"]!.dependenciesByMode.base = ["Bad Key"];

    expectSchemaInvalid(ajv, compiledSchema, sourceOrigin, "compiled source origin");
    expectIssueCode(parseCompiledScheme(sourceOrigin), "invalid-origin");
    expectSchemaInvalid(ajv, compiledSchema, invalidDependency, "compiled invalid dependency");
    expectIssueCode(parseCompiledScheme(invalidDependency), "invalid-dependencies");
  });

  test("compiled parser agrees with non-empty records and unique dependency schema rules", () => {
    expect.hasAssertions();
    const ajv = createAjv();
    const emptyTokens = validCompiledWithValue("#ffffff");
    emptyTokens.tokens = {};
    expectSchemaInvalid(ajv, compiledSchema, emptyTokens, "empty compiled tokens");
    expectIssueAt(parseCompiledScheme(emptyTokens), "invalid-object", "/tokens");

    const emptyMetadata = validCompiledWithValue("#ffffff");
    emptyMetadata.metadataByToken = {};
    expectSchemaInvalid(ajv, compiledSchema, emptyMetadata, "empty compiled metadata");
    expectIssueAt(parseCompiledScheme(emptyMetadata), "invalid-object", "/metadataByToken");

    const emptyTokenModes = validCompiledWithValue("#ffffff");
    emptyTokenModes.tokens["brand.600"] = {};
    expectSchemaInvalid(ajv, compiledSchema, emptyTokenModes, "empty compiled token modes");
    expectIssueAt(parseCompiledScheme(emptyTokenModes), "missing-mode-value", "/tokens/brand.600");

    const duplicateDependency = validCompiledWithValue("#ffffff");
    duplicateDependency.metadataByToken["brand.600"]!.dependenciesByMode.base = [
      "generated.brand.600",
      "generated.brand.600",
    ];

    expectSchemaInvalid(ajv, compiledSchema, duplicateDependency, "duplicate dependencies");
    expectIssueCode(parseCompiledScheme(duplicateDependency), "invalid-dependencies");
  });

  test("unknown safe extension keys and values round-trip through parsers", () => {
    const ajv = createAjv();
    const unusualExtensions = JSON.parse(
      '{"UPSTREAM vendor/key":{"safe":true},"__proto__":{"polluted":true}," spaced key ":["value",1,null]}',
    ) as Record<string, unknown>;
    const graph = validGraphWithValue("#ffffff");
    graph.tokens["brand.600"]!.extensions = unusualExtensions;
    const layer = validLayerWithValue("#ffffff");
    layer.tokens["brand.600"]!.extensions = unusualExtensions;
    const compiled = validCompiledWithValue("#ffffff");
    compiled.metadataByToken["brand.600"]!.extensions = unusualExtensions;

    expectSchemaValid(ajv, graphSchema, graph, "graph unusual extensions");
    expectSchemaValid(ajv, layerSchema, layer, "layer unusual extensions");
    expectSchemaValid(ajv, compiledSchema, compiled, "compiled unusual extensions");
    expect(
      expectResultOk(parseTokenGraph(graph), "graph unusual extensions").tokens["brand.600"]
        ?.extensions,
    ).toEqual(unusualExtensions);
    expect(
      expectResultOk(parseTokenLayer(layer), "layer unusual extensions").tokens["brand.600"]
        ?.extensions,
    ).toEqual(unusualExtensions);
    expect(
      expectResultOk(parseCompiledScheme(compiled), "compiled unusual extensions").metadataByToken[
        "brand.600"
      ]?.extensions,
    ).toEqual(unusualExtensions);
    expect((Object.prototype as { polluted?: unknown }).polluted).toBeUndefined();
  });

  test("graph parse and serialization round-trip canonically", () => {
    const ajv = createAjv();
    const parsed = expectResultOk(
      parseTokenGraph(readFixtureObject("valid", "multi-mode-strict-graph.json")),
      "graph round trip input",
    );
    const serialized = JSON.parse(serializeTokenGraph(parsed)) as unknown;

    expectSchemaValid(ajv, graphSchema, serialized, "serialized graph");
    expect(expectResultOk(parseTokenGraph(serialized), "serialized graph")).toEqual(parsed);
  });

  test("layer parse and serialization round-trip canonically", () => {
    const ajv = createAjv();
    const parsed = expectResultOk(
      parseTokenLayer(readFixtureObject("valid", "token-layer.json")),
      "layer round trip input",
    );
    const serialized = JSON.parse(serializeTokenLayer(parsed)) as unknown;

    expectSchemaValid(ajv, layerSchema, serialized, "serialized layer");
    expect(expectResultOk(parseTokenLayer(serialized), "serialized layer")).toEqual(parsed);
  });

  test("compiled parse and serialization round-trip canonically", () => {
    const ajv = createAjv();
    const input = {
      ...readFixtureObject("valid", "compiled-scheme.json"),
      $schema: compiledSchemaUri,
    };
    const parsed = expectResultOk(parseCompiledScheme(input), "compiled round trip input");
    const serialized = JSON.parse(serializeCompiledScheme(parsed)) as unknown;

    expect(serialized).toMatchObject({ $schema: compiledSchemaUri });
    expectSchemaValid(ajv, compiledSchema, serialized, "serialized compiled scheme");
    expect(expectResultOk(parseCompiledScheme(serialized), "serialized compiled scheme")).toEqual(
      parsed,
    );
  });

  test("graph parsing owns nested caller input", () => {
    const input = {
      $schema: graphSchemaUri,
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "brand.600": {
          value: { light: "#6750a4", dark: "#d0bcff" },
          extensions: { nested: { owner: "design" } },
        },
        primary: { value: { ref: "brand.600" } },
      },
      layers: [
        {
          kind: "scheme-tokens/token-layer",
          formatVersion: 1,
          id: "application",
          defaultVisibility: "public",
          tokens: {
            surface: { value: { light: "#ffffff", dark: "#111111" } },
          },
        },
      ],
    };
    const parsed = expectResultOk(parseTokenGraph(input), "owned graph");

    input.modes[0] = "changed";
    input.tokens["brand.600"].value.light = "changed";
    input.tokens["brand.600"].extensions.nested.owner = "changed";
    input.tokens.primary.value.ref = "changed";
    input.layers[0]!.tokens.surface.value.dark = "changed";

    expect(parsed).toMatchObject({
      modes: ["light", "dark"],
      tokens: {
        "brand.600": {
          value: { light: "#6750a4", dark: "#d0bcff" },
          extensions: { nested: { owner: "design" } },
        },
        primary: { value: { ref: "brand.600" } },
      },
      layers: [
        {
          tokens: { surface: { value: { light: "#ffffff", dark: "#111111" } } },
        },
      ],
    });
  });

  test("layer parsing owns nested caller input", () => {
    const input = {
      $schema: layerSchemaUri,
      kind: "scheme-tokens/token-layer",
      formatVersion: 1,
      id: "application",
      defaultVisibility: "public",
      tokens: {
        surface: {
          value: { light: "#ffffff", dark: "#111111" },
          extensions: { nested: { owner: "application" } },
        },
      },
    };
    const parsed = expectResultOk(parseTokenLayer(input), "owned layer");

    input.tokens.surface.value.light = "changed";
    input.tokens.surface.extensions.nested.owner = "changed";

    expect(parsed).toMatchObject({
      tokens: {
        surface: {
          value: { light: "#ffffff", dark: "#111111" },
          extensions: { nested: { owner: "application" } },
        },
      },
    });
  });

  test("compiled parsing owns nested caller input", () => {
    const input = {
      $schema: compiledSchemaUri,
      kind: "scheme-tokens/compiled-scheme",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      tokens: { "brand.600": { base: "#6750a4" } },
      metadataByToken: {
        "brand.600": {
          visibility: "public",
          origin: { kind: "graph" },
          dependenciesByMode: { base: ["brand.500"] },
          extensions: { nested: { owner: "design" } },
        },
      },
    };
    const parsed = expectResultOk(parseCompiledScheme(input), "owned compiled scheme");

    input.modes[0] = "changed";
    input.tokens["brand.600"].base = "changed";
    input.metadataByToken["brand.600"].dependenciesByMode.base[0] = "changed";
    input.metadataByToken["brand.600"].extensions.nested.owner = "changed";

    expect(parsed).toMatchObject({
      modes: ["base"],
      tokens: { "brand.600": { base: "#6750a4" } },
      metadataByToken: {
        "brand.600": {
          dependenciesByMode: { base: ["brand.500"] },
          extensions: { nested: { owner: "design" } },
        },
      },
    });
  });

  test("schemas and parsers reject artifact identity mismatches", () => {
    expect.hasAssertions();
    const ajv = createAjv();
    const missingGraphKind = withoutProperty(validGraphWithValue("#ffffff"), "kind");
    const wrongGraphKind = {
      ...validGraphWithValue("#ffffff"),
      kind: "scheme-tokens/token-layer",
    };
    const compiledAsGraph = validCompiledWithValue("#ffffff");
    const missingCompiledMetadata = withoutProperty(
      validCompiledWithValue("#ffffff"),
      "metadataByToken",
    );
    const graphAsCompiled = validGraphWithValue("#ffffff");

    expectSchemaInvalid(ajv, graphSchema, missingGraphKind, "missing graph kind");
    expectIssueCode(parseTokenGraph(missingGraphKind), "missing-property");
    expectSchemaInvalid(ajv, graphSchema, wrongGraphKind, "wrong graph kind");
    expectIssueCode(parseTokenGraph(wrongGraphKind), "invalid-artifact-kind");
    expectSchemaInvalid(ajv, graphSchema, compiledAsGraph, "compiled as graph");
    expectIssueCode(parseTokenGraph(compiledAsGraph), "invalid-artifact-kind");
    expectSchemaInvalid(ajv, compiledSchema, missingCompiledMetadata, "missing compiled metadata");
    expectIssueCode(parseCompiledScheme(missingCompiledMetadata), "missing-property");
    expectSchemaInvalid(ajv, compiledSchema, graphAsCompiled, "graph as compiled");
    expectIssueCode(parseCompiledScheme(graphAsCompiled), "invalid-artifact-kind");
  });
});

type PublicResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly unknown[] };

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
    kind: "scheme-tokens/token-graph",
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens: {
      "brand.600": { value },
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
    kind: "scheme-tokens/token-layer",
    formatVersion: 1,
    id: "brand",
    defaultVisibility: "public",
    tokens: {
      "brand.600": { value },
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
    kind: "scheme-tokens/compiled-scheme",
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    tokens: {
      "brand.600": { base: value },
    },
    metadataByToken: {
      "brand.600": {
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

function expectResultOk<Value>(result: PublicResult<Value>, label: string): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${label}: ${JSON.stringify(result.issues)}`);
  }
  return result.value;
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

function expectIssueCode(result: PublicResult<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error(`Expected issue code ${code}, got success.`);
  }
  expect(result.issues).toContainEqual(expect.objectContaining({ code }));
}

function expectIssueAt(result: PublicResult<unknown>, code: string, path: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error(`Expected issue code ${code} at ${path}, got success.`);
  }
  expect(result.issues).toContainEqual(expect.objectContaining({ code, path }));
}
