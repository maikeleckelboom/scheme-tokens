import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, test } from "vitest";
import {
  buildTokenSet,
  defineTokenFragment,
  parseTokenGraph,
  type Issue,
  type Result,
  type TokenDefinitionInput,
  type TokenGraphInput,
} from "color-scheme-tokens";
import * as adapter from "../src";
import { material3Source, type Material3SourceInput, type Material3SourceIssue } from "../src";
import { material3SourceColor6750a4Tokens } from "./fixtures/material3-0-4-0-6750a4";

function unwrap<Value>(result: Result<Value, Issue>): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}

describe("material3Source", () => {
  test("exports the intended runtime API", () => {
    expect(Object.keys(adapter).sort()).toEqual(["material3Source"]);
  });

  test("creates a structural TokenSource with defaults", () => {
    const source = material3Source({ sourceColor: "#6750a4" });
    const graph = unwrap(source.build());

    expect(source.id).toBe("material3");
    expect(graph).toMatchObject({
      formatVersion: 1,
      modes: ["light", "dark"],
      defaultMode: "light",
      defaultVisibility: "public",
    });
    expect(Object.keys(graph.tokens)).toContain("material3.primary");
    expect(parseTokenGraph(graph).ok).toBe(true);
  });

  test("builds a public token set through core buildTokenSet", () => {
    const built = unwrap(buildTokenSet({ source: material3Source({ sourceColor: "#6750a4" }) }));

    expect(built.graph.tokens["material3.primary"]?.origin).toEqual({
      kind: "source",
      id: "material3",
    });
    expect(built.tokenSet.tokens["material3.primary"]?.valueByMode.light).toEqual({
      colorSpace: "srgb",
      r: 0.396078431372549,
      g: 0.3333333333333333,
      b: 0.5607843137254902,
      alpha: 1,
    });
  });

  test("composes adapter output with caller fragments", () => {
    const application = defineTokenFragment<"light" | "dark">({
      id: "application",
      defaultVisibility: "public",
      tokens: {
        "app.background": { ref: "material3.surface" },
        "app.foreground": { ref: "material3.on-surface" },
        "app.action": { ref: "material3.primary" },
      },
    });

    const built = unwrap(
      buildTokenSet({
        source: material3Source({
          sourceColor: "#6750a4",
          defaultVisibility: "internal",
        }),
        fragments: [application],
      }),
    );

    expect(Object.keys(built.tokenSet.tokens)).toEqual([
      "app.action",
      "app.background",
      "app.foreground",
    ]);
    expect(built.graph.tokens["material3.primary"]?.visibility).toBe("internal");
    expect(built.graph.tokens["app.action"]?.origin).toEqual({
      kind: "fragment",
      id: "application",
    });
  });

  test("supports a custom lower-kebab namespace id", () => {
    const graph = unwrap(
      material3Source({
        id: "brand-material",
        sourceColor: "#6750A4",
      }).build(),
    );

    expect(Object.keys(graph.tokens)).toContain("brand-material.primary");
    expect(Object.keys(graph.tokens)).not.toContain("material3.primary");
  });

  test("rejects invalid inputs with adapter-owned JSON-safe issues", () => {
    const source = material3Source({
      sourceColor: "rgb(103 80 164)",
      id: "Material3",
      defaultVisibility: "hidden",
    } as unknown as Material3SourceInput);

    const result = source.build();

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: "material3-invalid-id", path: "/id" },
        {
          code: "material3-unsupported-color-input",
          field: "sourceColor",
          path: "/sourceColor",
        },
        { code: "material3-invalid-default-visibility", path: "/defaultVisibility" },
      ],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test("rejects missing sourceColor with an explicit field payload", () => {
    const result = material3Source({} as Material3SourceInput).build();

    expect(result).toMatchObject({
      ok: false,
      issues: [
        {
          code: "material3-invalid-source-color",
          field: "sourceColor",
          path: "/sourceColor",
        },
      ],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  test("rejects non-string source colors without CSS parsing", () => {
    const result = material3Source({
      sourceColor: { colorSpace: "srgb", r: 1, g: 1, b: 1 },
    } as unknown as Material3SourceInput).build();

    expect(result).toMatchObject({
      ok: false,
      issues: [
        {
          code: "material3-unsupported-color-input",
          field: "sourceColor",
          path: "/sourceColor",
          receivedType: "object",
        },
      ],
    });
  });

  test("rejects color, seed, and source aliases for the scheme source color", () => {
    for (const alias of ["color", "seed", "source"] as const) {
      const result = material3Source({
        [alias]: "#6750a4",
      } as unknown as Material3SourceInput).build();

      expect(result).toMatchObject({
        ok: false,
        issues: [
          {
            code: "material3-invalid-source-color",
            field: "sourceColor",
            path: "/sourceColor",
          },
          {
            code: "material3-invalid-input",
            path: `/${alias}`,
          },
        ],
      });
    }
  });

  test("rejects hostile input without throwing", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype trap should be contained");
        },
      },
    );

    expect(() => material3Source(hostile as Material3SourceInput).build()).not.toThrow();
    expect(material3Source(hostile as Material3SourceInput).build()).toMatchObject({
      ok: false,
      issues: [{ code: "material3-invalid-input" }],
    });
  });

  test("matches the @material/material-color-utilities@0.4.0 #6750a4 reference vector", () => {
    const graph = unwrap(material3Source({ sourceColor: "#6750a4" }).build());

    expect(extractGraphTokenValues(graph)).toEqual(material3SourceColor6750a4Tokens);
  });

  test("emits strict graph schema-compatible lower-kebab namespaced keys", () => {
    const graph = unwrap(material3Source({ sourceColor: "#6750a4" }).build());
    const ajv = createAjv();
    const validateGraph = ajv.getSchema(
      "https://color-scheme-tokens.dev/schemas/token-graph.v1.schema.json",
    );
    if (validateGraph === undefined) {
      throw new Error("Expected root token graph schema to be registered.");
    }

    expect(validateGraph(graph)).toBe(true);
    expect(validateGraph.errors).toBe(null);
    expect(Object.keys(graph.tokens)).toHaveLength(59);
    for (const key of Object.keys(graph.tokens)) {
      expect(key).toMatch(
        /^material3\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/,
      );
    }
  });

  test("keeps the adapter dependency model package-owned", () => {
    const manifest = readJsonObject(join(process.cwd(), "package.json"));

    expect(manifest.dependencies).toEqual({
      "@material/material-color-utilities": "0.4.0",
    });
    expect(manifest.peerDependencies).toEqual({
      "color-scheme-tokens": "0.0.0",
    });
    expect(manifest.devDependencies).toEqual({
      "color-scheme-tokens": "workspace:*",
    });
    expect(JSON.stringify(manifest.devDependencies)).not.toContain(
      "@material/material-color-utilities",
    );
  });
});

function extractGraphTokenValues(
  graph: TokenGraphInput,
): Readonly<Record<string, { readonly light: string; readonly dark: string }>> {
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

function createAjv(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    schemas: [
      readRootSchema("token-graph.v1.schema.json"),
      readRootSchema("token-fragment.v1.schema.json"),
      readRootSchema("compiled-token-set.v1.schema.json"),
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

function expectMaterial3SourceIssue(issue: Material3SourceIssue): Material3SourceIssue {
  return issue;
}

expectMaterial3SourceIssue({
  code: "material3-invalid-source-color",
  message: "sourceColor is required.",
  field: "sourceColor",
  path: "/sourceColor",
});
