import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
  type CssCondition,
  type ExportCssVarsOptions,
} from "../../src";

type TokenValues = Readonly<Record<string, string | Readonly<Record<string, string>>>>;

const MODE_POOL = ["light", "dark", "dim", "sepia", "contrast"] as const;
const VALUE_POOL = ["#ffffff", "#000000", "oklch(62% 0.18 250)", "var(--x, red)", "1px solid"];
const MEDIA_POOL = ["(prefers-color-scheme: dark)", "print", "screen and (width >= 48rem)"];
const SELECTOR_POOL = [".dark", "[data-palette='x']", ":is(.a, .b) .c", "#app > main"];

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
    const left = defineTokenGraph({
      modes: ["dark", "light"],
      defaultMode: "light",
      tokens: {
        "b.color": { dark: "#222222", light: "#111111" },
        "a.color": { dark: "#000000", light: "#ffffff" },
      },
    });
    const right = defineTokenGraph({
      modes: ["dark", "light"],
      defaultMode: "light",
      tokens: {
        "a.color": { light: "#ffffff", dark: "#000000" },
        "b.color": { light: "#111111", dark: "#222222" },
      },
    });

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

  test("CSS export is independent of insertion order and complete in every block", () => {
    fc.assert(
      fc.property(cssCase(), ({ modes, defaultMode, tokens, options }) => {
        const forward = compileAll(modes, defaultMode, tokens, false);
        const reversed = compileAll(modes, defaultMode, tokens, true);
        const left = exportCssVars(forward, options);
        const right = exportCssVars(reversed, reverseInsertion(options));

        expect(left).toEqual(right);
        if (!left.ok) {
          throw new Error(JSON.stringify(left.issues));
        }

        const keys = Object.keys(forward.tokens).sort(compareCodeUnits);
        for (const block of left.value.blocks) {
          expect(block.declarations.map((declaration) => declaration.tokenKey)).toEqual(keys);
        }

        // Within each tier, blocks follow the scheme's authored mode order, and a mode's custom
        // conditions keep their authored order.
        const tier = (name: string) =>
          left.value.blocks.filter((block) => block.tier === name).map((block) => block.mode);
        expect(tier("base")).toEqual([defaultMode]);
        expect(tier("system")).toEqual(modes.filter((mode) => options.system?.[mode]));
        expect(tier("explicit")).toEqual(
          options.attribute === false || (options.attribute === undefined && modes.length === 1)
            ? []
            : modes,
        );
        expect(
          left.value.blocks
            .filter((block) => block.tier === "custom")
            .map((block) => `${block.mode} ${block.selectors[0]} ${block.media ?? ""}`),
        ).toEqual(
          modes.flatMap((mode) =>
            conditionList(options.selectors?.[mode]).map(
              (condition) => `${mode} ${condition.selector} ${condition.media ?? ""}`,
            ),
          ),
        );
      }),
      { numRuns: 150 },
    );
  });

  test("CSS ordering is independent of localeCompare", () => {
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error("localeCompare must not participate in CSS ordering");
    };
    try {
      const compiled = compileAll(
        ["light", "dark"],
        "light",
        { z: "z", a: "a", "m.n": "m" },
        false,
      );
      const exported = exportCssVars(compiled, { selectors: { dark: ".dark" } });
      expect(exported.ok).toBe(true);
    } finally {
      String.prototype.localeCompare = original;
    }
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
      const graph = defineTokenGraph({ tokens: { z: "z", a: "a" } });
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
    expect(result.value.metadataByToken["chain.t10000"]?.expressionByMode?.base).toEqual({
      ref: "chain.t09999",
    });
  }, 20_000);
});

// Keys without in-segment hyphens map to distinct single-hyphen names, so every case exports.
function cssCase() {
  return fc
    .uniqueArray(fc.constantFrom(...MODE_POOL), { minLength: 1, maxLength: 4 })
    .chain((modes) => {
      const value = fc.constantFrom(...VALUE_POOL);
      const mode = fc.constantFrom(...modes);
      const condition = fc.record(
        { selector: fc.constantFrom(...SELECTOR_POOL), media: fc.constantFrom(...MEDIA_POOL) },
        { requiredKeys: ["selector"] },
      );
      const conditions = fc.oneof(
        fc.constantFrom(...SELECTOR_POOL),
        fc
          .array(condition, { minLength: 1, maxLength: 3 })
          .map((list) => list as [CssCondition, ...CssCondition[]]),
      );
      return fc.record({
        modes: fc.constant(modes),
        defaultMode: mode,
        tokens: fc.dictionary(
          fc
            .array(fc.stringMatching(/^[a-z][a-z0-9]{0,3}$/u), { minLength: 1, maxLength: 3 })
            .map((segments) => segments.join(".")),
          fc.oneof(value, fc.record(Object.fromEntries(modes.map((name) => [name, value])))),
          { minKeys: 1, maxKeys: 6 },
        ) as fc.Arbitrary<TokenValues>,
        options: fc.record(
          {
            prefix: fc.constantFrom("app", "color"),
            root: fc.constantFrom(":root", ":host", "#app"),
            attribute: fc.constantFrom<string | false>(false, "data-theme", "data-mode"),
            format: fc.constantFrom<"pretty" | "compact">("pretty", "compact"),
            cascadeLayer: fc.constantFrom("tokens", "app.tokens"),
            system: fc.dictionary(mode, fc.constantFrom(...MEDIA_POOL)),
            selectors: fc.dictionary(mode, conditions),
          },
          { requiredKeys: [] },
        ) as fc.Arbitrary<ExportCssVarsOptions>,
      });
    });
}

function compileAll(
  modes: readonly string[],
  defaultMode: string,
  tokens: TokenValues,
  reversed: boolean,
) {
  const entries = Object.entries(tokens).map(([key, value]) => {
    if (typeof value === "string") {
      return [key, value] as const;
    }
    const modeEntries = Object.entries(value);
    return [key, Object.fromEntries(reversed ? modeEntries.reverse() : modeEntries)] as const;
  });
  const compiled = compileTokenGraph(
    defineTokenGraph({
      modes: modes as [string, ...string[]],
      defaultMode,
      tokens: Object.fromEntries(reversed ? entries.reverse() : entries),
    }),
    { selection: "all" },
  );
  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.issues));
  }
  return compiled.value;
}

function reverseInsertion(options: ExportCssVarsOptions): ExportCssVarsOptions {
  return Object.fromEntries(
    Object.entries(options)
      .reverse()
      .map(([key, value]) => [
        key,
        key === "system" || key === "selectors"
          ? Object.fromEntries(Object.entries(value as object).reverse())
          : value,
      ]),
  ) as ExportCssVarsOptions;
}

function conditionList(
  value: string | readonly CssCondition[] | undefined,
): readonly CssCondition[] {
  if (value === undefined) {
    return [];
  }
  return typeof value === "string" ? [{ selector: value }] : value;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
