import { describe, expect, test } from "vitest";
import { canonicalizeExpression } from "../../src/core/canonical-expression";

describe("internal canonical expressions", () => {
  test.each([
    ["opaque {ref} text", "opaque {ref} text"],
    [{ ref: "brand.primary" }, { ref: "brand.primary" }],
    [
      { concat: ["a", "", "b", { ref: "brand.primary" }, "", "c", "d"] },
      { concat: ["ab", { ref: "brand.primary" }, "cd"] },
    ],
    [{ concat: ["a", "b"] }, "ab"],
    [{ concat: [""] }, ""],
    [{ concat: ["", { ref: "brand.primary" }, ""] }, { ref: "brand.primary" }],
    [{ concat: [{ ref: "a" }, { ref: "a" }] }, { concat: [{ ref: "a" }, { ref: "a" }] }],
  ])("normalizes %j", (input, expression) => {
    expect(canonicalizeExpression(input, "/value")).toMatchObject({
      ok: true,
      value: { expression },
    });
  });

  test.each([
    [{ concat: [] }, "/value"],
    [{ concat: [{ concat: ["a"] }] }, "/value/concat/0"],
    [{ concat: ["a", 1] }, "/value/concat/1"],
    [{ concat: ["a"], ref: "a" }, "/value"],
    [{ ref: "Invalid Key" }, "/value"],
    [{ concat: [{ ref: "a", extra: true }] }, "/value/concat/0"],
  ])("rejects invalid structure %j", (input, path) => {
    expect(canonicalizeExpression(input, "/value")).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-token-value", path }],
    });
  });

  test("copies references and preserves authored part paths across merging and collapse", () => {
    const reference = { ref: "a" };
    const parts = ["", reference, ""];
    const input = { concat: parts };
    const result = canonicalizeExpression(input, "/layers/0/tokens/b/value");
    expect(input).toEqual({ concat: ["", { ref: "a" }, ""] });
    reference.ref = "changed";
    parts.push("changed");
    expect(result).toEqual({
      ok: true,
      value: {
        expression: { ref: "a" },
        path: "/layers/0/tokens/b/value",
        referencePaths: ["/layers/0/tokens/b/value/concat/1"],
      },
    });
    expect(
      canonicalizeExpression({ concat: ["a", "b", { ref: "c" }, "", { ref: "d" }] }, "/value"),
    ).toMatchObject({
      ok: true,
      value: { referencePaths: ["/value/concat/2", "/value/concat/4"] },
    });
  });

  test("rejects accessors without invoking caller code", () => {
    const input = {
      get concat() {
        throw new Error("must not be read");
      },
    };
    expect(canonicalizeExpression(input, "/value")).toMatchObject({ ok: false });
  });
});
