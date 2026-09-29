import { describe, expect, test, vi } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
  serializeTokenLayer,
  tokenConcat,
  tokenRef,
  type Issue,
  type TokenGraph,
  type TokenGraphIssue,
} from "../../src";

function wire(tokens: unknown, extra: Record<string, unknown> = {}) {
  return {
    kind: "scheme-tokens/token-graph",
    formatVersion: 2,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens,
    ...extra,
  };
}
function layerWire(tokens: unknown, extra: Record<string, unknown> = {}) {
  return {
    kind: "scheme-tokens/token-layer",
    formatVersion: 2,
    id: "example",
    defaultVisibility: "public",
    tokens,
    ...extra,
  };
}
function thrownError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw new Error("Expected an Error instance");
  }
  throw new Error("Expected a structured failure");
}
function thrownIssues(run: () => unknown): readonly TokenGraphIssue[] {
  return thrownError(run).cause as readonly TokenGraphIssue[];
}

describe("P2 public v2 contract", () => {
  test.each(["public", "internal"] as const)(
    "explicit layer visibility restates %s and survives a graph override",
    (initial) => {
      const changed = initial === "public" ? "internal" : "public";
      const layers = [
        defineTokenLayer({ id: "first", defaultVisibility: initial, tokens: { a: "first" } }),
        defineTokenLayer({
          id: "second",
          tokens: {
            a: {
              value: "second",
              visibility: changed,
              description: "discard",
              deprecated: true,
              extensions: { discarded: true },
            },
          },
        }),
      ];
      const scheme = orThrow(
        compileTokenGraph(
          defineTokenGraph({ layers, tokens: { a: { value: "graph", description: "winner" } } }),
          { selection: "all" },
        ),
      );
      expect(scheme.tokens.a.base).toBe("graph");
      expect(scheme.metadataByToken.a).toEqual({
        visibility: changed,
        description: "winner",
        declarations: [
          { origin: { kind: "layer", id: "first" } },
          { origin: { kind: "layer", id: "second" }, visibility: changed },
          { origin: { kind: "graph" } },
        ],
      });
    },
  );

  test("all public source entries canonicalize flat concat and serialize only canonical data", () => {
    const tokens = {
      a: "A",
      b: { concat: ["x", "", "y", { ref: "a" }, ""] },
      c: { concat: ["a", "b"] },
      d: { concat: [""] },
    } as const;
    const strict = Object.fromEntries(
      Object.entries(tokens).map(([key, value]) => [key, { value }]),
    );
    const graphs = [defineTokenGraph({ tokens }), orThrow(parseTokenGraph(wire(strict)))];
    const layers = [
      defineTokenLayer({ id: "example", tokens }),
      orThrow(parseTokenLayer(layerWire(strict))),
    ];
    for (const input of [...graphs, ...layers]) {
      expect(input.tokens.b?.value).toEqual({ concat: ["xy", { ref: "a" }] });
      expect(input.tokens.c?.value).toBe("ab");
      expect(input.tokens.d?.value).toBe("");
    }
    const serialized = serializeTokenGraph(graphs[0]!);
    expect(serializeTokenGraph(orThrow(parseTokenGraph(JSON.parse(serialized))))).toBe(serialized);
    expect(serializeTokenLayer(layers[0]!)).toBe(serializeTokenLayer(layers[1]!));
  });

  test("cycles through mixed concat retain the original closing reference pointer", () => {
    expect(
      parseTokenGraph(
        wire({
          a: { value: { concat: ["prefix", { ref: "b" }] } },
          b: { value: { concat: ["x", "y", { ref: "a" }] } },
          dependent: { value: { ref: "a" } },
        }),
      ),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "reference-cycle", cycle: ["a", "b"], key: "b", path: "/tokens/b/value/concat/2" },
      ],
    });
  });

  test("tagged templates canonicalize, and every failure issue survives orThrow", () => {
    expect(tokenConcat``).toBe("");
    expect(tokenConcat`${tokenRef("a")}`).toEqual({ ref: "a" });
    expect(tokenConcat`0 0 ${tokenRef("a")} solid`).toEqual({
      concat: ["0 0 ", { ref: "a" }, " solid"],
    });
    const value = {};
    expect(orThrow({ ok: true, value })).toBe(value);
    const issues: readonly [Issue, ...Issue[]] = [
      { code: "one", path: "/a", message: "first" },
      { code: "two", message: "second" },
    ] as const;
    const error = thrownError(() => orThrow({ ok: false, issues }));
    expect(error.cause).toBe(issues);
    expect(error.message).toContain("one at /a: first");
    expect(error.message).toContain("two: second");
    expect(thrownError(() => orThrow({ ok: false, issues: [issues[0]] })).cause).toEqual([
      issues[0],
    ]);
    expect(thrownIssues(() => tokenConcat(null as never))).toMatchObject([
      { code: "invalid-token-value" },
    ]);
    expect(thrownIssues(() => tokenConcat`${{ concat: [tokenRef("a")] } as never}`)).toMatchObject([
      { code: "invalid-reference" },
    ]);
    expect(
      thrownIssues(() => defineTokenGraph({ $schema: "hint", tokens: {} } as never)),
    ).toMatchObject([{ code: "unknown-property", path: "/$schema" }]);
    expect(
      thrownIssues(() => defineTokenLayer({ $schema: "hint", id: "x", tokens: {} } as never)),
    ).toMatchObject([{ code: "unknown-property", path: "/$schema" }]);
  });

  test.each([
    [{ concat: ["x", { ref: "a" }] }, "xA"],
    [{ concat: "opaque" }, "opaque"],
    [{ concat: { ref: "a" } }, "A"],
    [{ concat: { concat: ["x", { ref: "a" }] } }, "xA"],
  ] as const)(
    "structurally distinguishes concat expressions from concat modes: %j",
    (value, expected) => {
      const graph = defineTokenGraph({
        modes: ["concat"],
        defaultMode: "concat",
        tokens: { a: "A", b: value },
      });
      for (const input of [
        graph,
        orThrow(
          parseTokenGraph(
            wire({ a: { value: "A" }, b: { value } }, { modes: ["concat"], defaultMode: "concat" }),
          ),
        ),
      ]) {
        const compiled = orThrow(compileTokenGraph(input));
        expect(compiled.modes).toEqual(["concat"]);
        expect(compiled.tokens.b?.concat).toBe(expected);
        const serialized = serializeTokenGraph(input);
        expect(serializeTokenGraph(orThrow(parseTokenGraph(JSON.parse(serialized))))).toBe(
          serialized,
        );
      }
    },
  );

  test("multi-mode concat key and default-independent authored order survive all boundaries", () => {
    const graph = defineTokenGraph({
      modes: ["concat", "dark", "light"],
      defaultMode: "light",
      tokens: { a: { concat: "opaque", dark: "other", light: "light" } },
    });
    const compiled = orThrow(compileTokenGraph(graph));
    const parsed = orThrow(parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled))));
    expect(parsed.modes).toEqual(["concat", "dark", "light"]);
    expect(parsed.defaultMode).toBe("light");
    expect(orThrow(exportCssVars(parsed)).blocks.map((block) => block.mode)).toEqual([
      "concat",
      "dark",
      "light",
    ]);
  });

  test.each([1, 2])(
    "source version %i retains concat mode, with ordinary v2 round trips",
    (formatVersion) => {
      const tokens = { a: { value: { concat: "opaque" } } };
      const graph = orThrow(
        parseTokenGraph(wire(tokens, { formatVersion, modes: ["concat"], defaultMode: "concat" })),
      );
      const layer = orThrow(parseTokenLayer(layerWire(tokens, { formatVersion })));
      expect(graph.formatVersion).toBe(2);
      expect(layer.formatVersion).toBe(2);
      expect(orThrow(compileTokenGraph(graph)).tokens.a?.concat).toBe("opaque");
      const layered = defineTokenGraph({
        modes: ["concat"],
        defaultMode: "concat",
        layers: [layer],
        tokens: {},
      });
      expect(orThrow(compileTokenGraph(layered)).tokens.a?.concat).toBe("opaque");
      expect(
        serializeTokenLayer(orThrow(parseTokenLayer(JSON.parse(serializeTokenLayer(layer))))),
      ).toBe(serializeTokenLayer(layer));
    },
  );

  test("concat mode supports v1 references and historical order without a migration exception", () => {
    const graph = orThrow(
      parseTokenGraph(
        wire(
          { a: { value: "A" }, b: { value: { concat: { ref: "a" }, dark: "B" } } },
          { formatVersion: 1, modes: ["concat", "dark"], defaultMode: "dark" },
        ),
      ),
    );
    expect(graph.modes).toEqual(["dark", "concat"]);
    expect(orThrow(compileTokenGraph(graph)).tokens.b).toEqual({ concat: "A", dark: "B" });
  });

  test.each([
    [{ concat: [] }, "invalid-token-value", "/tokens/b/value"],
    [{ concat: [{ concat: ["nested"] }] }, "invalid-token-value", "/tokens/b/value/concat/0"],
    [{ ref: 12 }, "invalid-reference", "/tokens/b/value"],
    [{ concat: ["x", { ref: "Bad Key" }] }, "invalid-reference", "/tokens/b/value/concat/1"],
  ])("rejects malformed expressions %j", (value, code, path) => {
    expect(parseTokenGraph(wire({ b: { value } }))).toMatchObject({
      ok: false,
      issues: [{ code, path }],
    });
    expect(thrownIssues(() => defineTokenGraph({ tokens: { b: value } } as never))).toMatchObject([
      { code, path: path.replace("/value", "") },
    ]);
  });

  test("unknown concat reference retains its original part pointer through normalization", () => {
    const value = { concat: ["a", "b", "", { ref: "missing" }, ""] };
    const expected = {
      code: "unknown-reference",
      path: "/tokens/b/value/concat/3",
      key: "b",
      mode: "base",
    };
    expect(parseTokenGraph(wire({ b: { value } }))).toMatchObject({
      ok: false,
      issues: [expected],
    });
    const graph = defineTokenGraph({ tokens: { b: value } } as never);
    expect(compileTokenGraph(graph)).toMatchObject({ ok: false, issues: [expected] });
  });

  test.each(["public", "internal"] as const)(
    "only explicit visibility overrides an introduced %s chain",
    (visibility) => {
      const first = defineTokenLayer({
        id: "first",
        defaultVisibility: visibility,
        tokens: {
          a: { value: "first", description: "old", deprecated: true, extensions: { old: 1 } },
          target: "first",
        },
      });
      const second = defineTokenLayer({
        id: "second",
        defaultVisibility: visibility === "public" ? "internal" : "public",
        tokens: { a: "second" },
      });
      const graph = defineTokenGraph({
        defaultVisibility: "public",
        layers: [first, second],
        tokens: { a: tokenRef("target"), target: "graph" },
      });
      const result = orThrow(compileTokenGraph(graph, { selection: "all" }));
      expect(result.tokens.a.base).toBe("graph");
      expect(result.metadataByToken.a).toEqual({
        visibility,
        declarations: [
          { origin: { kind: "layer", id: "first" } },
          { origin: { kind: "layer", id: "second" } },
          { origin: { kind: "graph" } },
        ],
        expressionByMode: { base: { ref: "target" } },
      });
      const restated = defineTokenGraph({
        layers: [first, second],
        tokens: {
          a: { value: "explicit", visibility: visibility === "public" ? "internal" : "public" },
        },
      });
      expect(
        orThrow(compileTokenGraph(restated, { selection: "all" })).metadataByToken.a,
      ).toMatchObject({
        visibility: visibility === "public" ? "internal" : "public",
        declarations: [{}, {}, { visibility: visibility === "public" ? "internal" : "public" }],
      });
    },
  );

  test("sparse D6 expressions carry only concat reference-part values", () => {
    const graph = defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "dark",
      tokens: {
        a: { light: "A", dark: "B" },
        b: { light: tokenRef("a"), dark: "literal" },
        c: tokenConcat`[${tokenRef("b")}]`,
      },
    });
    const compiled = orThrow(compileTokenGraph(graph));
    expect(compiled.metadataByToken.a?.expressionByMode).toBeUndefined();
    expect(compiled.metadataByToken.b?.expressionByMode).toEqual({ light: { ref: "a" } });
    expect(compiled.metadataByToken.c?.expressionByMode).toEqual({
      light: { concat: ["[", { ref: "b", value: "A" }, "]"] },
      dark: { concat: ["[", { ref: "b", value: "literal" }, "]"] },
    });
    expect(orThrow(parseCompiledScheme(JSON.parse(serializeCompiledScheme(compiled))))).toEqual(
      compiled,
    );
  });

  test("layer mode sets ignore order and reject one deterministic conflicting map", () => {
    const valid = defineTokenLayer({
      id: "valid",
      tokens: { invariant: "x", a: { light: "a", dark: "b" }, b: { dark: "c", light: "d" } },
    });
    expect(
      defineTokenGraph({
        modes: ["dark", "light"],
        defaultMode: "light",
        layers: [valid],
        tokens: {},
      }).modes,
    ).toEqual(["dark", "light"]);
    const invalid = {
      z: { dark: "z" },
      b: { dim: "b", light: "b", dark: "b" },
      a: { light: "a", dark: "a" },
    };
    const issue = {
      code: "layer-mode-mismatch",
      layerId: "example",
      key: "b",
      path: "/tokens/b",
      firstPath: "/tokens/a",
      modes: ["dark", "light"],
      layerModes: ["dark", "dim", "light"],
    };
    expect(thrownIssues(() => defineTokenLayer({ id: "example", tokens: invalid }))).toMatchObject([
      issue,
    ]);
    for (const formatVersion of [1, 2]) {
      expect(
        parseTokenLayer(
          layerWire(
            Object.fromEntries(Object.entries(invalid).map(([key, value]) => [key, { value }])),
            { formatVersion },
          ),
        ),
      ).toMatchObject({
        ok: false,
        issues: [{ ...issue, path: "/tokens/b/value", firstPath: "/tokens/a/value" }],
      });
    }
    expect(
      thrownIssues(() =>
        defineTokenGraph({
          modes: ["dim", "light", "dark"],
          defaultMode: "light",
          layers: [valid],
          tokens: {},
        }),
      ),
    ).toMatchObject([
      {
        code: "layer-mode-mismatch",
        path: "/layers/0",
        layerId: "valid",
        modes: ["dim", "light", "dark"],
        layerModes: ["dark", "light"],
      },
    ]);
    expect(
      defineTokenGraph({
        modes: ["dim"],
        defaultMode: "dim",
        layers: [defineTokenLayer({ id: "invariant", tokens: { a: "x" } })],
        tokens: {},
      }).modes,
    ).toEqual(["dim"]);
  });

  test("cycles are canonical, point to the closing occurrence, and report once", () => {
    const values = {
      z: { value: { ref: "b" } },
      b: { value: { concat: ["", { ref: "c" }] } },
      c: { value: { ref: "b" } },
    };
    const first = parseTokenGraph(wire(values));
    const second = parseTokenGraph(wire(Object.fromEntries(Object.entries(values).reverse())));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: false,
      issues: [{ code: "reference-cycle", key: "c", path: "/tokens/c/value", cycle: ["b", "c"] }],
    });
    const dag = defineTokenGraph({
      tokens: {
        a: "x",
        b: tokenConcat`${tokenRef("a")}${tokenRef("a")}`,
        c: tokenRef("a"),
        d: tokenConcat`${tokenRef("b")}${tokenRef("c")}`,
      },
    });
    expect(orThrow(compileTokenGraph(dag)).tokens.d?.base).toBe("xxx");
  });

  test.each([
    [65_535, true],
    [65_536, false],
  ] as const)("public concat bound is checked before joining at %i + 1", (length, valid) => {
    const graph = defineTokenGraph({
      tokens: {
        a: "x".repeat(length),
        b: tokenConcat`${tokenRef("a")}!`,
        dependant: tokenRef("b"),
      },
    });
    const join = Array.prototype.join;
    const spy = vi.spyOn(Array.prototype, "join").mockImplementation(function (
      this: unknown[],
      separator?: string,
    ) {
      if (separator === "" && this.every((part) => typeof part === "string")) {
        expect((this as string[]).reduce((sum, part) => sum + part.length, 0)).toBeLessThanOrEqual(
          65_536,
        );
      }
      return join.call(this, separator);
    });
    let result;
    try {
      result = compileTokenGraph(graph);
    } finally {
      spy.mockRestore();
    }
    expect(result.ok).toBe(valid);
    expect(result.ok ? [] : result.issues).toMatchObject(
      valid
        ? []
        : [{ code: "resolved-value-too-long", key: "b", mode: "base", path: "/tokens/b/value" }],
    );
    const literal = "😀".repeat(40_000);
    expect(
      orThrow(compileTokenGraph(defineTokenGraph({ tokens: { a: literal, b: tokenRef("a") } })))
        .tokens.b?.base,
    ).toBe(literal);
  });

  test("v1 synthetic layer ids avoid adversarial collisions and add only required visibility", () => {
    const input = wire(
      { a: { value: "graph", description: "original" }, own: { value: "own" } },
      {
        formatVersion: 1,
        defaultVisibility: "internal",
        layers: [
          layerWire({ a: { value: "layer" } }, { formatVersion: 1, id: "v1-graph" }),
          layerWire({ other: { value: "other" } }, { formatVersion: 1, id: "v1-graph-1" }),
        ],
      },
    );
    const graph = orThrow(parseTokenGraph(input));
    expect(graph.layers?.map((layer) => layer.id)).toEqual([
      "v1-graph-2",
      "v1-graph",
      "v1-graph-1",
    ]);
    expect(graph.layers?.[0]?.tokens.a).toEqual({ value: "graph", description: "original" });
    expect(graph.layers?.[1]?.tokens.a).toEqual({ value: "layer", visibility: "public" });
    expect(graph.tokens.own?.visibility).toBeUndefined();
    expect(orThrow(compileTokenGraph(graph)).tokens.a?.base).toBe("layer");
    expect(
      serializeTokenGraph(orThrow(parseTokenGraph(JSON.parse(serializeTokenGraph(graph))))),
    ).toBe(serializeTokenGraph(graph));
    const broken = {
      ...input,
      layers: [layerWire({ a: { value: { ref: "missing" } } }, { formatVersion: 1 })],
    };
    expect(parseTokenGraph(broken)).toMatchObject({
      ok: false,
      issues: [{ code: "unknown-reference", path: "/layers/0/tokens/a/value" }],
    });
  });

  test("concat resolves internal targets before every selection and counts UTF-16 units", () => {
    const graph = defineTokenGraph({
      tokens: {
        a: { value: "😀".repeat(32_767), visibility: "internal" },
        b: tokenConcat`${tokenRef("a")}😀`,
      },
    });
    for (const selection of ["public", "all", { keys: ["b"] }] as const) {
      const compiled = orThrow(compileTokenGraph(graph, { selection }));
      expect(compiled.tokens.b?.base.length).toBe(65_536);
      expect(compiled.metadataByToken.b?.expressionByMode?.base).toEqual({
        concat: [{ ref: "a", value: "😀".repeat(32_767) }, "😀"],
      });
    }
    expect(
      compileTokenGraph(
        defineTokenGraph({ tokens: { a: "😀".repeat(32_768), b: tokenConcat`${tokenRef("a")}x` } }),
      ),
    ).toMatchObject({ ok: false, issues: [{ code: "resolved-value-too-long", key: "b" }] });
  });

  test("public exponential DAG fails before oversized allocation and suppresses dependents", () => {
    const tokens: Record<string, string | { concat: readonly [{ ref: string }, { ref: string }] }> =
      { "t.0": "x" };
    for (let index = 1; index <= 100; index += 1) {
      tokens[`t.${index}`] = { concat: [{ ref: `t.${index - 1}` }, { ref: `t.${index - 1}` }] };
    }
    const graph = defineTokenGraph({ tokens });
    const join = Array.prototype.join;
    let largest = 0;
    const spy = vi.spyOn(Array.prototype, "join").mockImplementation(function (
      this: unknown[],
      separator?: string,
    ) {
      if (separator === "" && this.every((part) => typeof part === "string")) {
        largest = Math.max(
          largest,
          (this as string[]).reduce((sum, part) => sum + part.length, 0),
        );
      }
      return join.call(this, separator);
    });
    let result;
    try {
      result = compileTokenGraph(graph);
    } finally {
      spy.mockRestore();
    }
    expect(largest).toBe(65_536);
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "resolved-value-too-long", key: "t.17" }],
    });
  });

  test("schema hints are v2 data, v1 hints stay historical, compiled v1 must be rebuilt", () => {
    const hint = "foreign:anything";
    const graph = orThrow(parseTokenGraph(wire({ a: { value: "x" } }, { $schema: hint })));
    expect(JSON.parse(serializeTokenGraph(graph)).$schema).toBe(hint);
    const layer = orThrow(parseTokenLayer(layerWire({ a: { value: "x" } }, { $schema: hint })));
    expect(JSON.parse(serializeTokenLayer(layer)).$schema).toBe(hint);
    const compiled = orThrow(compileTokenGraph(graph));
    const parsed = orThrow(parseCompiledScheme({ ...compiled, $schema: hint }));
    expect(JSON.parse(serializeCompiledScheme(parsed)).$schema).toBe(hint);
    expect(serializeCompiledScheme(compiled)).not.toContain("$schema");
    expect(
      parseTokenGraph(wire({ a: { value: "x" } }, { formatVersion: 1, $schema: hint })),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-schema-uri" }] });
    expect(
      orThrow(
        parseTokenGraph(
          wire(
            { a: { value: "x" } },
            {
              formatVersion: 1,
              $schema: "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
            },
          ),
        ),
      ).$schema,
    ).toBeUndefined();
    expect(parseCompiledScheme({ ...compiled, formatVersion: 1 })).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "invalid-format-version",
          message: expect.stringMatching(/recompile.*source graph/),
        }),
      ],
    });
  });

  test("safe data readers never invoke hostile getters and own nested caller data", () => {
    const getter = vi.fn<() => never>(() => {
      throw new Error("hostile");
    });
    const input = wire({
      a: { value: Object.defineProperty({}, "concat", { enumerable: true, get: getter }) },
    });
    expect(parseTokenGraph(input).ok).toBe(false);
    expect(getter).not.toHaveBeenCalled();
    const tokens = Object.assign(Object.create(null) as Record<string, { value: string }>, {
      a: { value: "x" },
    });
    const graph = orThrow(parseTokenGraph(wire(tokens)));
    tokens.a!.value = "mutated";
    expect(graph.tokens.a?.value).toBe("x");
    expect(
      compileTokenGraph({ ...graph, formatVersion: 1 } as unknown as TokenGraph),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-format-version" }] });
  });
});
