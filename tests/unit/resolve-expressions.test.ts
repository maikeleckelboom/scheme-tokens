import { describe, expect, test, vi } from "vitest";
import { canonicalizeExpression, type ExpressionSource } from "../../src/core/canonical-expression";
import {
  createExpressionResolver,
  MAX_RESOLVED_VALUE_LENGTH,
  type ResolutionIssue,
} from "../../src/core/resolve-expressions";

function fixture(expressions: Readonly<Record<string, unknown>>) {
  const sources = new Map<string, ExpressionSource>();
  for (const [key, input] of Object.entries(expressions)) {
    const result = canonicalizeExpression(input, `/tokens/${key}/value`);
    if (!result.ok) {
      throw new Error(JSON.stringify(result.issues));
    }
    sources.set(key, result.value);
  }
  const issues: ResolutionIssue[] = [];
  const sourceFor = vi.fn<(key: string) => ExpressionSource | undefined>((key) => sources.get(key));
  const resolve = createExpressionResolver(sourceFor, (issue) => issues.push(issue));
  return { resolve, issues, sourceFor };
}

describe("iterative memoized expression resolution", () => {
  test("resolves literals, empty values, references, chains and mixed concat in part order", () => {
    const { resolve, issues } = fixture({
      literal: "x",
      empty: "",
      ref: { ref: "literal" },
      chain: { ref: "ref" },
      single: { concat: ["[", { ref: "chain" }, "]"] },
      multiple: { concat: [{ ref: "single" }, " / ", { ref: "literal" }, { ref: "empty" }] },
    });
    expect(resolve("multiple", "base")).toBe("[x] / x");
    expect(resolve("chain", "base")).toBe("x");
    expect(resolve("empty", "base")).toBe("");
    expect(issues).toEqual([]);
  });

  test.each([false, true])(
    "repeated siblings and diamond DAGs are valid (reverse: %s)",
    (reverse) => {
      const refs = [{ ref: "left" }, { ref: "right" }];
      const { resolve, issues, sourceFor } = fixture({
        shared: { concat: ["[", { ref: "leaf" }, "]"] },
        leaf: "x",
        left: { concat: [{ ref: "shared" }, " / ", { ref: "shared" }] },
        right: { ref: "shared" },
        root: { concat: reverse ? [...refs].reverse() : refs },
      });
      expect(resolve("root", "base")).toBe(reverse ? "[x][x] / [x]" : "[x] / [x][x]");
      expect(resolve("shared", "base")).toBe("[x]");
      expect(resolve("root", "base")).toBe(reverse ? "[x][x] / [x]" : "[x] / [x][x]");
      expect(sourceFor.mock.calls.filter(([key]) => key === "shared")).toHaveLength(1);
      expect(sourceFor.mock.calls).toHaveLength(5);
      expect(issues).toEqual([]);
    },
  );

  test("memoizes independently by key and mode without delimiter collisions", () => {
    const sourceFor = vi.fn<(key: string, mode: string) => ExpressionSource>((key, mode) => ({
      expression: `${key}:${mode}`,
      path: "",
      referencePaths: [],
    }));
    const resolve = createExpressionResolver(sourceFor, () => {
      throw new Error("unexpected failure");
    });
    expect(resolve("a", "b\0c")).toBe("a:b\0c");
    expect(resolve("a\0b", "c")).toBe("a\0b:c");
    expect(resolve("a", "light")).toBe("a:light");
    expect(resolve("a", "dark")).toBe("a:dark");
    expect(resolve("a", "light")).toBe("a:light");
    expect(sourceFor).toHaveBeenCalledTimes(4);
  });

  test("starts at the head of a 20,000-edge chain without recursion", () => {
    const tokens: Record<string, unknown> = { t0: "leaf" };
    for (let index = 1; index <= 20_000; index += 1) {
      tokens[`t${index}`] = { ref: `t${index - 1}` };
    }
    const { resolve, sourceFor, issues } = fixture(tokens);
    expect(resolve("t20000", "base")).toBe("leaf");
    expect(resolve("t19999", "base")).toBe("leaf");
    expect(sourceFor).toHaveBeenCalledTimes(20_001);
    expect(issues).toEqual([]);
  });

  test.each([
    [{ ref: "missing" }, "/tokens/broken/value"],
    [{ concat: ["", { ref: "missing" }, ""] }, "/tokens/broken/value/concat/1"],
    [
      { concat: ["a", "b", { ref: "missing" }, { ref: "missing" }] },
      "/tokens/broken/value/concat/2",
    ],
  ])("reports an unknown target once at the original source %j", (broken, path) => {
    const { resolve, issues } = fixture({
      broken,
      first: { ref: "broken" },
      second: { concat: [{ ref: "broken" }, "!"] },
    });
    expect(resolve("first", "base")).toBeUndefined();
    expect(resolve("second", "base")).toBeUndefined();
    expect(resolve("broken", "base")).toBeUndefined();
    expect(issues).toEqual([
      expect.objectContaining({ code: "unknown-reference", key: "broken", mode: "base", path }),
    ]);
  });

  test.each([
    [{ a: { ref: "a" } }, "a", ["a"], "/tokens/a/value"],
    [
      {
        a: { ref: "b" },
        b: { concat: ["x", { ref: "c" }] },
        c: { concat: ["", { ref: "a" }, "!"] },
      },
      "c",
      ["a", "b", "c"],
      "/tokens/c/value/concat/1",
    ],
  ])(
    "reports real cycles at the closing reference and suppresses dependants",
    (tokens, key, cycle, path) => {
      const { resolve, issues } = fixture({ ...tokens, dependant: { ref: "a" } });
      expect(resolve("dependant", "base")).toBeUndefined();
      expect(resolve("a", "base")).toBeUndefined();
      expect(issues).toEqual([
        expect.objectContaining({ code: "reference-cycle", key, mode: "base", cycle, path }),
      ]);
    },
  );

  test("failed nodes in one mode do not poison another mode", () => {
    const issues: ResolutionIssue[] = [];
    const resolve = createExpressionResolver(
      (key, mode) =>
        key === "a"
          ? {
              expression: mode === "dark" ? { ref: "a" } : "light value",
              path: `/a/${mode}`,
              referencePaths: [],
            }
          : undefined,
      (issue) => issues.push(issue),
    );
    expect(resolve("a", "dark")).toBeUndefined();
    expect(resolve("a", "light")).toBe("light value");
    expect(issues).toHaveLength(1);
  });
});

describe("concat pre-allocation bound", () => {
  test.each([
    ["x".repeat(65_535), "!", true],
    ["x".repeat(65_536), "!", false],
    ["😀".repeat(32_767), "😀", true],
    ["😀".repeat(32_768), "!", false],
  ])("uses UTF-16 string.length (case %#)", (literal, suffix, succeeds) => {
    const { resolve, issues } = fixture({
      literal,
      result: { concat: [{ ref: "literal" }, suffix] },
    });
    const result = resolve("result", "base");
    expect(result?.length).toBe(succeeds ? MAX_RESOLVED_VALUE_LENGTH : undefined);
    expect(issues).toEqual(
      succeeds
        ? []
        : [
            {
              code: "resolved-value-too-long",
              message: "Resolved concat exceeds 65,536 UTF-16 code units.",
              key: "result",
              mode: "base",
              path: "/tokens/result/value",
            },
          ],
    );
  });

  test("authored literals and canonical collapses remain unbounded", () => {
    const literal = "x".repeat(65_537);
    const { resolve, issues } = fixture({
      literal,
      alias: { ref: "literal" },
      text: { concat: [literal, "!"] },
      collapsed: { concat: ["", { ref: "literal" }, ""] },
    });
    expect(resolve("literal", "base")).toBe(literal);
    expect(resolve("alias", "base")).toBe(literal);
    expect(resolve("text", "base")).toBe(`${literal}!`);
    expect(resolve("collapsed", "base")).toBe(literal);
    expect(issues).toEqual([]);
  });

  test("65-token exponential chain joins only bounded values and reports the first overflow once", () => {
    const tokens: Record<string, unknown> = { t0: "12345678" };
    for (let index = 1; index < 65; index += 1) {
      tokens[`t${index}`] = { concat: [{ ref: `t${index - 1}` }, { ref: `t${index - 1}` }] };
    }
    const { resolve, issues, sourceFor } = fixture(tokens);
    const join = Array.prototype.join;
    const builtLengths: number[] = [];
    const spy = vi.spyOn(Array.prototype, "join").mockImplementation(function (
      this: string[],
      separator?: string,
    ) {
      // Check BEFORE invoking the real allocator: an oversized attempted join fails this test.
      const length = this.reduce((sum, part) => sum + part.length, 0);
      if (separator !== "" || length > MAX_RESOLVED_VALUE_LENGTH) {
        throw new Error(`Unexpected or oversized join: ${length}`);
      }
      const value = join.call(this, separator);
      builtLengths.push(value.length);
      return value;
    });
    let result: string | undefined;
    try {
      result = resolve("t64", "base");
      resolve("t14", "base");
      resolve("t64", "base");
    } finally {
      spy.mockRestore();
    }
    expect(result).toBeUndefined();
    expect(builtLengths).toEqual(Array.from({ length: 13 }, (_, index) => 8 * 2 ** (index + 1)));
    expect(Math.max(...builtLengths)).toBe(65_536);
    expect(resolve("t13", "base")?.length).toBe(65_536);
    expect(sourceFor).toHaveBeenCalledTimes(65);
    expect(issues).toEqual([
      expect.objectContaining({
        code: "resolved-value-too-long",
        key: "t14",
        mode: "base",
        path: "/tokens/t14/value",
      }),
    ]);
  });
});
