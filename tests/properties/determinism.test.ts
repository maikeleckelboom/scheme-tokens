import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
} from "../../src";

describe("determinism and parser safety properties", () => {
  test("all untrusted parsers do not throw for JSON values", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(() => parseTokenGraph(value)).not.toThrow();
        expect(() => parseTokenLayer(value)).not.toThrow();
        expect(() => parseCompiledScheme(value)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });

  test("construction order does not change canonical graph or compiled serialization", () => {
    const left = defineTokens(
      {
        "b.color": { dark: "#222222", light: "#111111" },
        "a.color": { dark: "#000000", light: "#ffffff" },
      },
      { modes: ["dark", "light"], defaultMode: "light" },
    );
    const right = defineTokens(
      {
        "a.color": { light: "#ffffff", dark: "#000000" },
        "b.color": { light: "#111111", dark: "#222222" },
      },
      { modes: ["light", "dark"], defaultMode: "light" },
    );

    expect(serializeTokenGraph(left)).toBe(serializeTokenGraph(right));
    const leftCompiled = compileTokenGraph(left);
    const rightCompiled = compileTokenGraph(right);
    expect(leftCompiled.ok).toBe(true);
    expect(rightCompiled.ok).toBe(true);
    if (!leftCompiled.ok || !rightCompiled.ok) {
      throw new Error("Expected both graphs to compile");
    }
    expect(serializeCompiledScheme(leftCompiled.value)).toBe(
      serializeCompiledScheme(rightCompiled.value),
    );
  });

  test("selector-map insertion order does not change CSS", () => {
    const compiled = compileTokenGraph(
      defineTokens(
        { background: { light: "#fff", dark: "#000" } },
        { modes: ["light", "dark"], defaultMode: "light" },
      ),
    );
    if (!compiled.ok) {
      throw new Error(JSON.stringify(compiled.issues));
    }

    const left = exportCssVars(compiled.value, {
      modeSelectors: {
        strategy: "selectors",
        selectors: { dark: ".dark", light: ":root" },
      },
    });
    const right = exportCssVars(compiled.value, {
      modeSelectors: {
        strategy: "selectors",
        selectors: { light: ":root", dark: ".dark" },
      },
    });
    expect(left).toEqual(right);
  });

  test("token insertion order does not change diagnostic order", () => {
    const left = parseTokenGraph({
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "z.token": { value: { ref: "missing.z" } },
        "a.token": { value: { ref: "missing.a" } },
      },
    });
    const right = parseTokenGraph({
      kind: "scheme-tokens/token-graph",
      formatVersion: 1,
      modes: ["base"],
      defaultMode: "base",
      defaultVisibility: "public",
      tokens: {
        "a.token": { value: { ref: "missing.a" } },
        "z.token": { value: { ref: "missing.z" } },
      },
    });
    expect(left).toEqual(right);
  });

  test("canonical ordering is independent of localeCompare", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("localeCompare must not participate in canonical ordering");
    };
    try {
      const graph = defineTokens({ z: "z", a: "a" });
      const compiled = compileTokenGraph(graph);
      expect(compiled.ok).toBe(true);
      expect(serializeTokenGraph(graph)).toContain('"a"');
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  test("deep reference chains are stack-safe", () => {
    const tokens: Record<string, { value: string | { ref: string } }> = {
      "chain.t00000": { value: "#000000" },
    };
    for (let index = 1; index <= 10_000; index += 1) {
      tokens[`chain.t${index.toString().padStart(5, "0")}`] = {
        value: { ref: `chain.t${(index - 1).toString().padStart(5, "0")}` },
      };
    }

    const result = compileTokenGraph(defineTokenGraph({ tokens }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected chain graph to compile");
    }
    expect(Object.keys(result.value.tokens)).toHaveLength(10_001);
    expect(result.value.metadataByToken["chain.t10000"]?.dependenciesByMode.base).toEqual([
      "chain.t09999",
    ]);
  }, 20_000);
});
