import fc from "fast-check";
import { expect, test } from "vitest";
import { canonicalizeExpression, type ExpressionSource } from "../../src/core/canonical-expression";
import { createExpressionResolver } from "../../src/core/resolve-expressions";

test("canonicalization preserves bounded DAG values independently of root traversal order", () => {
  const part = fc.oneof(fc.string({ maxLength: 4 }), fc.nat({ max: 100 }));
  fc.assert(
    fc.property(
      fc.array(fc.array(part, { minLength: 1, maxLength: 3 }), { minLength: 1, maxLength: 9 }),
      (rows) => {
        const sources = new Map<string, ExpressionSource>();
        const expected: string[] = ["leaf"];
        sources.set("t0", { expression: "leaf", path: "/t0", referencePaths: [] });
        for (const [index, row] of rows.entries()) {
          const input = {
            concat: row.map((item) =>
              typeof item === "string" ? item : { ref: `t${item % (index + 1)}` },
            ),
          };
          const result = canonicalizeExpression(input, `/t${index + 1}`);
          if (!result.ok) {
            throw new Error(JSON.stringify(result.issues));
          }
          sources.set(`t${index + 1}`, result.value);
          expected.push(
            row
              .map((item) => (typeof item === "string" ? item : expected[item % (index + 1)]))
              .join(""),
          );
          const again = canonicalizeExpression(result.value.expression, result.value.path);
          expect(again.ok && again.value.expression).toEqual(result.value.expression);
        }
        const keys = [...sources.keys()];
        for (const order of [keys, [...keys].reverse()]) {
          const resolve = createExpressionResolver(
            (key) => sources.get(key),
            (issue) => {
              throw new Error(JSON.stringify(issue));
            },
          );
          for (const key of order) {
            expect(resolve(key, "base")).toBe(expected[Number(key.slice(1))]);
          }
        }
      },
    ),
    { seed: 40301, numRuns: 200 },
  );
});
