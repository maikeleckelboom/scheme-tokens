import { expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  parseTokenGraph,
  parseTokenLayer,
  tokenRef,
} from "../../src";

test.each([
  { concat: ["x", { ref: "a" }] },
  { concat: ["x", "y"] },
  { concat: ["", { ref: "a" }, ""] },
  { concat: [] },
])("v1 public boundaries still reject concat: %j", (concat) => {
  const tokens = { a: { value: concat } };
  expect(() => defineTokens(tokens as never)).toThrow(TypeError);
  expect(() => defineTokenGraph({ tokens } as never)).toThrow(TypeError);
  expect(() => defineTokenLayer({ id: "example", tokens } as never)).toThrow(TypeError);
  const graph = {
    kind: "scheme-tokens/token-graph",
    formatVersion: 1,
    modes: ["base"],
    defaultMode: "base",
    defaultVisibility: "public",
    tokens,
  };
  // Exact pre-P1 parser diagnostics; concat is not routed through the internal canonicalizer.
  expect(parseTokenGraph(graph)).toEqual({
    ok: false,
    issues: [
      {
        code: "unknown-mode-value",
        message: "Token value contains unknown mode: concat.",
        path: "/tokens/a/value/concat",
        mode: "concat",
      },
      {
        code: "missing-mode-value",
        message: "Token value is missing mode: base.",
        path: "/tokens/a/value",
        mode: "base",
      },
    ],
  });
  expect(
    parseTokenLayer({
      kind: "scheme-tokens/token-layer",
      formatVersion: 1,
      id: "example",
      defaultVisibility: "public",
      tokens,
    }),
  ).toEqual({
    ok: false,
    issues: [
      {
        code: "invalid-token-value",
        message: "Token values must be authored CSS strings or explicit references.",
        path: "/tokens/a/value/concat",
      },
    ],
  });
  expect(compileTokenGraph(graph as never)).toMatchObject({
    ok: false,
    issues: [
      { code: "unknown-mode-value", path: "/tokens/a/value/concat" },
      { code: "missing-mode-value", path: "/tokens/a/value" },
    ],
  });
});

test("v1 still allows concat as an ordinary mode name", () => {
  const graph = defineTokens(
    { a: { concat: "opaque" } },
    { modes: ["concat"], defaultMode: "concat" },
  );
  expect(compileTokenGraph(graph)).toMatchObject({
    ok: true,
    value: { tokens: { a: { concat: "opaque" } } },
  });
});

test("public v1 compilation keeps oversized literals and pure references valid", () => {
  const literal = "x".repeat(65_537);
  expect(compileTokenGraph(defineTokens({ literal, alias: tokenRef("literal") }))).toMatchObject({
    ok: true,
    value: { tokens: { literal: { base: literal }, alias: { base: literal } } },
  });
});
