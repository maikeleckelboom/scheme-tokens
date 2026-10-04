import { describe, expect, test } from "vitest";
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "../../src";

describe("bounded selector grammar", () => {
  test.each([
    ":root",
    ":host",
    ":host([data-theme='dark'])",
    ':host([data-theme="dark"])',
    ":host(.themed#app)",
    ".dark",
    "#app",
    "*",
    '[data-theme="dark"]',
    "[data-palette=brand i]",
    "[hidden]",
    "main#app.shell[data-theme=dark][aria-current]",
    "html:root",
    ":not(.disabled)",
    ".card:not(.disabled, [aria-hidden])",
    ":is(.a, .b)",
    ":where([data-x], .x)",
    ":where(:is(.a, :not(.b > .c)), .d)",
    ":host(:not(.plain))",
    "html body.dark",
    "#app > main.content[data-view='work']",
    "header + main",
    "main ~ aside",
    ":root, .light",
    '[data-palette="vivid"]:not([data-scheme="light"])',
    `${":is(".repeat(8)}.a${")".repeat(8)}`,
  ])("accepts %s as a custom condition and as root", (selector) => {
    const exported = orThrow(
      exportCssVars(scheme(), { activation: { root: selector, selectors: { base: selector } } }),
    );

    expect(exported.blocks.map((block) => block.selectors)).toEqual([[selector], [selector]]);
    expect(exported.css).toContain(`:where(${selector}) {`);
  });

  test.each([
    ["empty", ""],
    ["leading space", " .a"],
    ["unbalanced pseudo", ":not(.a"],
    ["stray parenthesis", ".a)"],
    ["empty :not", ":not()"],
    ["empty :is", ":is()"],
    ["empty :where", ":where( )"],
    ["empty :host argument", ":host()"],
    ["complex :host argument", ":host(.a .b)"],
    ["list :host argument", ":host(.a, .b)"],
    ["space before argument", ":is (.a)"],
    ["unknown pseudo-class", ".a:hover"],
    ["unsupported functional pseudo-class", ":has(.a)"],
    ["root is not functional", ":root(.a)"],
    ["pseudo-element", ".a::before"],
    ["uppercase pseudo-class", ":ROOT"],
    ["nesting selector", "& .a"],
    ["comment", ".a/*x*/"],
    ["comment close", ".a*/"],
    ["brace", ".a{color:red}"],
    ["semicolon", ".a;.b"],
    ["at-rule", "@media print"],
    ["backslash escape", ".a\\:b"],
    ["control character", ".a\n.b"],
    ["trailing combinator", "div >"],
    ["double comma", "div,,span"],
    ["double combinator", "div + ~ span"],
    ["unterminated attribute", '[data-x="'],
    ["namespace attribute", "[svg|href]"],
    ["over depth", `${":is(".repeat(9)}.a${")".repeat(9)}`],
    ["over length", `.${"a".repeat(256)}`],
  ])("rejects the %s selector", (_label, selector) => {
    expect(
      exportCssVars(scheme(), { activation: { selectors: { base: selector } } }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-selector", tier: "selector", mode: "base", selector }],
    });
    expect(exportCssVars(scheme(), { activation: { root: selector } })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-root", selector }],
    });
  });

  test("pathological nesting is rejected quickly", () => {
    const started = performance.now();
    for (let depth = 1; depth <= 2_000; depth += 1) {
      const nested = `${":not(".repeat(depth)}.a${")".repeat(depth)}`;
      exportCssVars(scheme(), { activation: { root: nested } });
    }
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});

describe("bounded media grammar", () => {
  test.each([
    "(prefers-color-scheme: dark)",
    "(prefers-color-scheme:light)",
    "(min-width: 48rem)",
    "( min-width : 48rem )",
    "(color)",
    "screen",
    "print",
    "all",
    "not print",
    "only screen",
    "screen and (min-width: 48rem)",
    "only screen and (min-width: 48rem) and (orientation: landscape)",
    "screen and not (hover)",
    "(min-width: 48rem) or (prefers-contrast: more)",
    "(min-width: 48rem) and (max-width: 80rem) and (hover)",
    "not (prefers-reduced-motion: reduce)",
    "((min-width: 48rem) or (hover)) and (color)",
    "(width >= 48rem)",
    "(48rem <= width)",
    "(40rem < width <= 80rem)",
    "(80rem > width > 40rem)",
    "(width = 100%)",
    "(aspect-ratio: 16/9)",
    "(min-aspect-ratio: 16 / 9)",
    "(-webkit-min-device-pixel-ratio: 2)",
    "(min-resolution: 1.5dppx)",
    `${"(".repeat(8)}color${")".repeat(8)}`,
    `${"(not ".repeat(7)}(color)${")".repeat(7)}`,
  ])("accepts %s for system and custom conditions", (media) => {
    const exported = orThrow(
      exportCssVars(scheme(), {
        activation: { media: { base: media }, selectors: { base: [{ selector: ".a", media }] } },
      }),
    );

    expect(exported.blocks.map((block) => block.media)).toEqual([undefined, media, media]);
    expect(exported.css).toContain(`@media ${media} {`);
  });

  test.each([
    ["empty", ""],
    ["trailing space", "(color) "],
    ["brace", "(color) {"],
    ["closing brace", "(color)} .a {"],
    ["semicolon", "(color); @import url(x)"],
    ["comment", "(color)/**/"],
    ["backslash", "(col\\or)"],
    ["nested at-rule", "@media (color)"],
    ["control character", "(color)\n"],
    ["unbalanced open", "(prefers-color-scheme: dark"],
    ["unbalanced close", "(color))"],
    ["media query list", "screen, print"],
    ["mixed and/or", "(a) and (b) or (c)"],
    ["or after a media type", "screen and (a) or (b)"],
    ["dangling and", "screen and"],
    ["leading and", "and (color)"],
    ["double operator", "(a) and and (b)"],
    ["bare not", "not"],
    ["not with and", "not (a) and (b)"],
    ["only without type", "only (color)"],
    ["missing spaces", "(a)and (b)"],
    ["unknown media type", "tv"],
    ["uppercase keyword", "SCREEN"],
    ["empty feature", "()"],
    ["missing value", "(min-width:)"],
    ["string value", '(min-width: "48rem")'],
    ["function value", "(min-width: calc(1px + 2px))"],
    ["identifier range value", "(width > auto)"],
    ["mismatched range", "(40rem < width > 80rem)"],
    ["equals range", "(40rem = width = 80rem)"],
    ["adjacent values", "(min-width: 48rem 2)"],
    ["over depth", `${"(".repeat(9)}color${")".repeat(9)}`],
    ["negation over depth", `${"(not ".repeat(8)}(color)${")".repeat(8)}`],
    ["over length", `(min-width: ${"1".repeat(250)}px)`],
  ])("rejects the %s media condition", (_label, media) => {
    expect(
      exportCssVars(scheme(), {
        activation: { media: { base: media }, selectors: { base: [{ selector: ".a", media }] } },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-media", tier: "media", mode: "base", media },
        { code: "invalid-media", tier: "selector", mode: "base", index: 0, media },
      ],
    });
  });

  test("pathological media nesting is rejected quickly", () => {
    const started = performance.now();
    for (let depth = 1; depth <= 1_000; depth += 1) {
      const nested = `${"(not ".repeat(depth)}(color)${")".repeat(depth)}`;
      exportCssVars(scheme(), { activation: { media: { base: nested } } });
      exportCssVars(scheme(), {
        activation: { media: { base: `${"(".repeat(depth)}color${")".repeat(depth)}` } },
      });
    }
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});

describe("cascade layer names", () => {
  test.each(["tokens", "theme-v2", "app.tokens", "app.tokens.base"])("accepts %s", (layer) => {
    expect(orThrow(exportCssVars(scheme(), { cascadeLayer: layer })).css).toMatch(
      new RegExp(`^@layer ${layer.replaceAll(".", "\\.")} \\{\\n`, "u"),
    );
  });

  test.each([
    "",
    "Tokens",
    "tokens ",
    "tokens,base",
    "tokens{",
    "tokens;",
    "tokens/**/",
    "app..tokens",
    ".tokens",
    "tokens.",
    "-tokens",
    "revert-layer",
    "app.initial",
    "a".repeat(129),
  ])("rejects %j", (layer) => {
    expect(exportCssVars(scheme(), { cascadeLayer: layer })).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-cascade-layer" }],
    });
  });
});

describe("declaration value safety", () => {
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
    const exported = exportCssVars(
      orThrow(compileTokenGraph(defineTokenGraph({ tokens: { unsafe: value } }))),
    );

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
    expect(
      exportCssVars(orThrow(compileTokenGraph(defineTokenGraph({ tokens: { unsafe: value } }))), {
        references: "resolved",
      }),
    ).toEqual(exported);
  });

  test.each([
    "#ffffff",
    "oklch(62% 0.18 250)",
    "var(--brand-600, #6750a4)",
    "calc(100% - 1rem)",
    'var(--label, "a; } !important")',
  ])("preserves the declaration-safe value %j", (value) => {
    const exported = orThrow(
      exportCssVars(orThrow(compileTokenGraph(defineTokenGraph({ tokens: { safe: value } })))),
    );

    expect(exported.blocks[0]?.declarations[0]?.value).toBe(value);
  });

  test("each emitted value is checked once, and unemitted modes are not checked", () => {
    const compiled = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["light", "dark", "print"],
          defaultMode: "light",
          tokens: {
            unsafe: { light: "red;", dark: "blue;", print: "black;" },
            fine: "#ffffff",
          },
        }),
      ),
    );

    // The light value is declared by the base and the custom block but reported once.
    expect(
      exportCssVars(compiled, { activation: { selectors: { light: ".light", dark: ".dark" } } }),
    ).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: "invalid-css-value", mode: "light" }),
        expect.objectContaining({ code: "invalid-css-value", mode: "dark" }),
      ],
    });
  });
});

function scheme() {
  return orThrow(compileTokenGraph(defineTokenGraph({ tokens: { background: "#fff" } })));
}
