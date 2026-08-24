import { describe, expect, test } from "vitest";
import { compileTokenGraph, defineTokens, exportCssVars } from "../../src";

describe("CSS export safety", () => {
  test.each([
    ":root",
    ".dark",
    "#app",
    "main#app.shell[data-theme=dark][aria-current]",
    "html body.dark",
    "#app > main.content[data-view='work']",
    "header + main",
    "main ~ aside",
    ":root, .light",
  ])("accepts the bounded safe selector %s", (selector) => {
    const exported = expectOk(
      exportCssVars(singleModeScheme(), {
        modeSelectors: {
          strategy: "selectors",
          selectors: { base: selector },
        },
      }),
    );

    expect(exported.blocks[0]?.selector).toBe(selector);
  });

  test.each(["[", ".", "#", ".foo[", '[data-x="', "div >", "div,,span", "div + ~ span"])(
    "rejects the malformed selector %s",
    (selector) => {
      expect(
        exportCssVars(singleModeScheme(), {
          modeSelectors: {
            strategy: "selectors",
            selectors: { base: selector },
          },
        }),
      ).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-selector", mode: "base", selector }],
      });
    },
  );

  test("allows append-safe element, class, id, and attribute compounds", () => {
    const compiled = expectOk(
      compileTokenGraph(
        defineTokens(
          { background: { light: "#fff", dark: "#111" } },
          { modes: ["light", "dark"], defaultMode: "light" },
        ),
      ),
    );
    const exported = expectOk(
      exportCssVars(compiled, {
        scope: { strategy: "selector", selector: "main#app.shell[data-app]" },
        modeSelectors: { strategy: "data-attribute", attribute: "data-theme" },
      }),
    );

    expect(exported.blocks.map((block) => block.selector)).toEqual([
      "main#app.shell[data-app]",
      'main#app.shell[data-app][data-theme="dark"]',
    ]);
  });

  test("rejects a separate scope when exact selectors own the complete selector", () => {
    expect(
      exportCssVars(singleModeScheme(), {
        scope: { strategy: "root" },
        modeSelectors: {
          strategy: "selectors",
          selectors: { base: ":root" },
        },
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-scope" }],
    });
  });

  test.each([
    "red; color: blue",
    "red; } body { color: lime",
    "red/*comment*/",
    "red*/blue",
    "red\nblue",
    "red\u0000blue",
    "red !important",
    "red ! IMPORTANT",
    "var(--color",
    "calc(1px + [2px)",
    'url("unterminated)',
  ])("rejects the declaration-escaping value %j", (value) => {
    const exported = exportCssVars(expectOk(compileTokenGraph(defineTokens({ unsafe: value }))));

    expect(exported).toMatchObject({
      ok: false,
      issues: [
        {
          code: "invalid-css-value",
          key: "unsafe",
          mode: "base",
          path: "/tokens/unsafe/base",
        },
      ],
    });
  });

  test.each([
    "#ffffff",
    "oklch(62% 0.18 250)",
    "var(--brand-600, #6750a4)",
    "calc(100% - 1rem)",
    'var(--label, "a; } !important")',
  ])("preserves the declaration-safe value %j", (value) => {
    const exported = expectOk(
      exportCssVars(expectOk(compileTokenGraph(defineTokens({ safe: value })))),
    );

    expect(exported.blocks[0]?.declarations[0]?.value).toBe(value);
  });
});

function singleModeScheme() {
  return expectOk(compileTokenGraph(defineTokens({ background: "#fff" })));
}

function expectOk<Value>(
  result:
    | {
        readonly ok: true;
        readonly value: Value;
      }
    | {
        readonly ok: false;
        readonly issues: readonly unknown[];
      },
): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
}
