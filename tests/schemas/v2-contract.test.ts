import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  orThrow,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  tokenConcat,
  tokenRef,
} from "../../src";

const graph = defineTokenGraph({
  modes: ["concat", "dark"],
  defaultMode: "dark",
  tokens: { a: "A", b: { concat: tokenConcat`x${tokenRef("a")}`, dark: tokenRef("a") } },
});
const layer = defineTokenLayer({
  id: "example",
  tokens: { a: { concat: "opaque", dark: "other" } },
});
const compiled = orThrow(compileTokenGraph(graph));
const cases = [
  { kind: "token-graph", value: graph, parse: parseTokenGraph },
  { kind: "token-layer", value: layer, parse: parseTokenLayer },
  { kind: "compiled-scheme", value: compiled, parse: parseCompiledScheme },
] as const;

describe("v2 standalone schema contract", () => {
  test.each(cases)(
    "$kind has an exact public identity and only fragment references",
    ({ kind, value, parse }) => {
      const schema = JSON.parse(readFileSync(`schemas/${kind}.v2.schema.json`, "utf8")) as Record<
        string,
        unknown
      >;
      const id = `tag:maikel.site,2026-09-29:scheme-tokens/schema/${kind}/v2`;
      expect(schema.$id).toBe(id);
      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      const refs: unknown[] = [];
      const visit = (input: unknown): void => {
        if (input === null || typeof input !== "object") {
          return;
        }
        for (const [key, child] of Object.entries(input)) {
          if (key === "$ref") {
            refs.push(child);
          }
          visit(child);
        }
      };
      visit(schema);
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.every((ref) => typeof ref === "string" && ref.startsWith("#"))).toBe(true);
      const ajv = new Ajv2020({ strict: true, allErrors: true });
      const validate = ajv.compile(schema);
      expect(validate(value)).toBe(true);
      const byId = ajv.compile({ $ref: id });
      expect(byId(value)).toBe(true);
      for (const hint of [
        undefined,
        `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/${kind}.v2.schema.json`,
        "stale:v1",
        "foreign:anything",
        "",
      ]) {
        const input = hint === undefined ? value : { ...value, $schema: hint };
        expect(validate(input)).toBe(true);
        const parsed = parse(input);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) {
          throw new Error(JSON.stringify(parsed.issues));
        }
        expect(parsed.value.$schema).toBe(hint);
      }
      expect(validate({ ...value, $schema: 2 })).toBe(false);
      expect(validate({ ...value, unknown: true })).toBe(false);
      expect(validate({ ...value, formatVersion: 1 })).toBe(false);
    },
  );

  test.each([
    { concat: ["x", { ref: "a" }] },
    { concat: "opaque" },
    { concat: { ref: "a" } },
    { concat: { concat: ["x", { ref: "a" }] } },
    { concat: "opaque", dark: "other" },
  ])("source alternatives unambiguously accept %j", (value) => {
    for (const kind of ["token-graph", "token-layer"]) {
      const schema = JSON.parse(readFileSync(`schemas/${kind}.v2.schema.json`, "utf8")) as object;
      const validate = new Ajv2020({ strict: true }).compile(schema);
      const envelope = kind === "token-graph" ? graph : layer;
      expect(validate({ ...envelope, tokens: { a: { value: "A" }, b: { value } } })).toBe(true);
    }
  });

  test.each([
    { concat: [] },
    { concat: [{ concat: ["nested"] }] },
    { concat: [1] },
    { concat: ["x", { ref: "a", extra: true }] },
  ])("source schemas reject malformed concat %j", (value) => {
    for (const kind of ["token-graph", "token-layer"]) {
      const schema = JSON.parse(readFileSync(`schemas/${kind}.v2.schema.json`, "utf8")) as object;
      expect(
        new Ajv2020({ strict: true }).validate(schema, {
          ...(kind === "token-graph" ? graph : layer),
          tokens: { b: { value } },
        }),
      ).toBe(false);
    }
  });

  test.each([
    { declarations: [] },
    { declarations: [{ origin: { kind: "graph" }, visibility: "public" }] },
    { declarations: [{ origin: { kind: "graph", id: "extra" } }] },
    { declarations: [{ origin: { kind: "layer" } }] },
    { declarations: [{ origin: { kind: "graph" }, declaredVisibility: "private" }] },
    { origin: { kind: "graph" } },
    { dependenciesByMode: { concat: [] } },
    { expressionByMode: {} },
    { expressionByMode: { concat: "literal" } },
    { expressionByMode: { concat: { ref: "a", value: "A" } } },
    { expressionByMode: { concat: { concat: ["x", { ref: "a" }] } } },
    { expressionByMode: { concat: { concat: ["x", { ref: "a", value: 2 }] } } },
    { expressionByMode: { concat: { concat: ["x", { ref: "a", value: "A", extra: true }] } } },
    { expressionByMode: { concat: { concat: ["x", "literal"] } } },
    { expressionByMode: { concat: { concat: ["", { ref: "a", value: "A" }] } } },
    { expressionByMode: { concat: { concat: [{ ref: "a", value: "A" }] } } },
  ])("strict compiled metadata rejects %j", (patch) => {
    const input = {
      ...compiled,
      metadataByToken: {
        ...compiled.metadataByToken,
        b: { ...compiled.metadataByToken.b, ...patch },
      },
    };
    const schema = JSON.parse(
      readFileSync("schemas/compiled-scheme.v2.schema.json", "utf8"),
    ) as object;
    expect(new Ajv2020({ strict: true }).validate(schema, input)).toBe(false);
    expect(parseCompiledScheme(input).ok).toBe(false);
  });

  test("runtime additionally rejects adjacent literals and unknown retained modes", () => {
    for (const expressionByMode of [
      { concat: { concat: ["x", "y", { ref: "a", value: "A" }] } },
      { unknown: { ref: "a" } },
    ]) {
      expect(
        parseCompiledScheme({
          ...compiled,
          metadataByToken: {
            ...compiled.metadataByToken,
            b: { ...compiled.metadataByToken.b, expressionByMode },
          },
        }).ok,
      ).toBe(false);
    }
  });
});
