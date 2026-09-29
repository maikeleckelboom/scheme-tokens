import { expect, test } from "vitest";
import { parseTokenGraph, parseTokenLayer } from "../../src";

test.each([
  { concat: ["x", { ref: "a" }] },
  { concat: ["x", "y"] },
  { concat: ["", { ref: "a" }, ""] },
  { concat: [] },
])("v1 grammar rejects arrays before upgrading: %j", (value) => {
  const tokens = { a: { value } };
  const graph = {
    kind: "scheme-tokens/token-graph",
    formatVersion: 1,
    modes: ["concat"],
    defaultMode: "concat",
    defaultVisibility: "public",
    tokens,
  };
  const layer = {
    kind: "scheme-tokens/token-layer",
    formatVersion: 1,
    id: "example",
    defaultVisibility: "public",
    tokens,
  };
  for (const result of [parseTokenGraph(graph), parseTokenLayer(layer)]) {
    expect(result).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value", path: "/tokens/a/value/concat" }],
    });
  }
});
