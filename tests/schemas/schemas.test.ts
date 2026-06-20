import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import { compileTokenGraph, serializeTokenSet } from "../../src";

const schemaDirectory = join(process.cwd(), "schemas");
const graphSchema = JSON.parse(
  readFileSync(join(schemaDirectory, "token-graph.v1.schema.json"), "utf8"),
);
const fragmentSchema = JSON.parse(
  readFileSync(join(schemaDirectory, "token-fragment.v1.schema.json"), "utf8"),
);
const compiledSchema = JSON.parse(
  readFileSync(join(schemaDirectory, "compiled-token-set.v1.schema.json"), "utf8"),
);

describe("JSON Schemas", () => {
  test("schemas validate representative v1 artifacts", () => {
    const ajv = new Ajv2020({ schemas: [graphSchema, fragmentSchema, compiledSchema] });
    const graph = {
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
      tokens: {
        "app.background": {
          valueByMode: {
            light: "#ffffff",
            dark: "#111111",
          },
        },
      },
    };
    expect(ajv.validate(graphSchema, graph)).toBe(true);

    const compiled = compileTokenGraph(graph);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) throw new Error("Expected schema fixture to compile");
    expect(ajv.validate(compiledSchema, JSON.parse(serializeTokenSet(compiled.value)))).toBe(true);
  });

  test("schemas reject obvious old or malformed shapes", () => {
    const ajv = new Ajv2020({ schemas: [graphSchema, fragmentSchema, compiledSchema] });
    expect(
      ajv.validate(graphSchema, {
        schemaVersion: "color-scheme-token-graph/v0",
        modes: ["light"],
        tokens: [],
      }),
    ).toBe(false);
  });
});
