import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  parseCompiledScheme,
  serializeCompiledScheme,
  type CssVarBlock,
} from "../../src";

describe("CSS activation blocks", () => {
  test("a one-mode scheme emits only the base block by default", () => {
    const exported = orThrow(exportCssVars(singleModeScheme()));

    expect(exported.css).toBe(":where(:root) {\n  --background: #ffffff;\n}\n");
    expect(exported.blocks).toEqual([
      {
        tier: "base",
        mode: "base",
        selectors: [":root"],
        declarations: [{ tokenKey: "background", property: "--background", value: "#ffffff" }],
      },
    ]);
    expect(exported.blocks[0]).not.toHaveProperty("media");
  });

  test("a multi-mode scheme adds explicit markers for every mode, the default included", () => {
    const exported = orThrow(exportCssVars(lightDarkScheme()));

    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", [":root"], undefined],
      ["explicit", "light", ['[data-theme="light"]'], undefined],
      ["explicit", "dark", ['[data-theme="dark"]'], undefined],
    ]);
    expect(exported.css).toBe(
      ":where(:root) {\n" +
        "  --background: #ffffff;\n" +
        "  --foreground: #111111;\n" +
        "}\n\n" +
        ':where([data-theme="light"]) {\n' +
        "  --background: #ffffff;\n" +
        "  --foreground: #111111;\n" +
        "}\n\n" +
        ':where([data-theme="dark"]) {\n' +
        "  --background: #111111;\n" +
        "  --foreground: #eeeeee;\n" +
        "}\n",
    );
  });

  test("tiers are base, system, explicit, then custom; within a tier, authored mode order", () => {
    const scheme = threeModeScheme();
    const exported = orThrow(
      exportCssVars(scheme, {
        system: { sepia: "(min-width: 48rem)", dark: "(prefers-color-scheme: dark)" },
        selectors: {
          sepia: ".sepia",
          dark: [{ selector: ".dark" }, { selector: ".night", media: "print" }],
        },
      }),
    );

    // Authored order is dark, light, sepia; the default (light) is not moved first.
    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", [":root"], undefined],
      ["system", "dark", [":root"], "(prefers-color-scheme: dark)"],
      ["system", "sepia", [":root"], "(min-width: 48rem)"],
      ["explicit", "dark", ['[data-theme="dark"]'], undefined],
      ["explicit", "light", ['[data-theme="light"]'], undefined],
      ["explicit", "sepia", ['[data-theme="sepia"]'], undefined],
      ["custom", "dark", [".dark"], undefined],
      ["custom", "dark", [".night"], "print"],
      ["custom", "sepia", [".sepia"], undefined],
    ]);
  });

  test("authored mode order and condition order are semantic; option insertion order is not", () => {
    const forward = threeModeScheme();
    const reversed = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["sepia", "light", "dark"],
          defaultMode: "light",
          tokens: { background: { dark: "#111111", light: "#ffffff", sepia: "#f4ecd8" } },
        }),
      ),
    );
    const options = { attribute: false, selectors: { dark: ".dark", sepia: ".sepia" } } as const;
    const permutedOptions = {
      selectors: { sepia: ".sepia", dark: ".dark" },
      attribute: false,
    } as const;

    expect(orThrow(exportCssVars(forward, options)).css).toBe(
      orThrow(exportCssVars(forward, permutedOptions)).css,
    );
    expect(customModes(orThrow(exportCssVars(forward, options)).blocks)).toEqual(["dark", "sepia"]);
    expect(customModes(orThrow(exportCssVars(reversed, options)).blocks)).toEqual([
      "sepia",
      "dark",
    ]);

    const conditions = orThrow(
      exportCssVars(forward, {
        attribute: false,
        selectors: { dark: [{ selector: ".b" }, { selector: ".a" }] },
      }),
    );
    expect(conditions.blocks.slice(1).map((block) => block.selectors[0])).toEqual([".b", ".a"]);
  });

  test("every block declares every selected token in canonical key order", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["light", "dark"],
          defaultMode: "light",
          tokens: {
            "z.last": { light: "zl", dark: "zd" },
            same: "shared",
            "a.first": { light: "al", dark: "ad" },
            "brand.600": { light: "bl", dark: "bd" },
          },
        }),
      ),
    );
    const exported = orThrow(
      exportCssVars(scheme, {
        system: { dark: "(prefers-color-scheme: dark)" },
        selectors: { light: ".light", dark: [{ selector: ".dark" }, { selector: ".dim" }] },
      }),
    );

    const expectedKeys = ["a.first", "brand.600", "same", "z.last"];
    expect(exported.blocks).toHaveLength(7);
    for (const block of exported.blocks) {
      expect(block.declarations.map((declaration) => declaration.tokenKey)).toEqual(expectedKeys);
      for (const declaration of block.declarations) {
        expect(declaration.value).toBe(scheme.tokens[declaration.tokenKey][block.mode]);
      }
    }
  });

  test("attribute false disables explicit markers and leaves custom conditions", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), {
        attribute: false,
        selectors: { dark: ".dark" },
      }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", [":root"], undefined],
      ["custom", "dark", [".dark"], undefined],
    ]);
  });

  test("an explicit attribute applies to any mode count, and omission defaults only with several", () => {
    expect(
      summarize(orThrow(exportCssVars(singleModeScheme(), { attribute: "data-mode" })).blocks),
    ).toEqual([
      ["base", "base", [":root"], undefined],
      ["explicit", "base", ['[data-mode="base"]'], undefined],
    ]);
    expect(
      orThrow(exportCssVars(lightDarkScheme(), { attribute: "data-color-scheme" })).blocks.map(
        (block) => block.selectors[0],
      ),
    ).toEqual([":root", '[data-color-scheme="light"]', '[data-color-scheme="dark"]']);
  });

  test("explicit markers stay unanchored for any root", () => {
    const exported = orThrow(exportCssVars(lightDarkScheme(), { root: "#app" }));

    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", ["#app"], undefined],
      ["explicit", "light", ['[data-theme="light"]'], undefined],
      ["explicit", "dark", ['[data-theme="dark"]'], undefined],
    ]);
  });

  test("a :host root targets the host for base and system blocks and the host and shadow tree for markers", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), {
        root: ":host",
        system: { dark: "(prefers-color-scheme: dark)" },
      }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", [":host"], undefined],
      ["system", "dark", [":host"], "(prefers-color-scheme: dark)"],
      ["explicit", "light", [':host([data-theme="light"])', '[data-theme="light"]'], undefined],
      ["explicit", "dark", [':host([data-theme="dark"])', '[data-theme="dark"]'], undefined],
    ]);
    expect(exported.css).toContain(":where(:host) {\n");
    expect(exported.css).toContain("@media (prefers-color-scheme: dark) {\n  :where(:host) {\n");
    expect(exported.css).toContain(':where(:host([data-theme="dark"]), [data-theme="dark"]) {\n');
  });

  test("pretty output nests media blocks and separates blocks with one blank line", () => {
    const exported = orThrow(
      exportCssVars(singleTokenLightDark(), {
        system: { dark: "(prefers-color-scheme: dark)" },
        selectors: {
          dark: [{ selector: ".dark, .night", media: "screen and (min-width: 48rem)" }],
        },
      }),
    );

    expect(exported.css).toBe(
      [
        ":where(:root) {",
        "  --surface: #ffffff;",
        "}",
        "",
        "@media (prefers-color-scheme: dark) {",
        "  :where(:root) {",
        "    --surface: #000000;",
        "  }",
        "}",
        "",
        ':where([data-theme="light"]) {',
        "  --surface: #ffffff;",
        "}",
        "",
        ':where([data-theme="dark"]) {',
        "  --surface: #000000;",
        "}",
        "",
        "@media screen and (min-width: 48rem) {",
        "  :where(.dark, .night) {",
        "    --surface: #000000;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("compact output keeps block order and removes insignificant whitespace", () => {
    const exported = orThrow(
      exportCssVars(singleTokenLightDark(), {
        format: "compact",
        root: ":host",
        system: { dark: "(prefers-color-scheme: dark)" },
        selectors: { dark: [{ selector: ".dark", media: "print" }] },
      }),
    );

    expect(exported.css).toBe(
      ":where(:host){--surface:#ffffff;}" +
        "@media (prefers-color-scheme: dark){:where(:host){--surface:#000000;}}" +
        ':where(:host([data-theme="light"]),[data-theme="light"]){--surface:#ffffff;}' +
        ':where(:host([data-theme="dark"]),[data-theme="dark"]){--surface:#000000;}' +
        "@media print{:where(.dark){--surface:#000000;}}",
    );
  });

  test("cascadeLayer wraps the complete output, media blocks included", () => {
    const options = {
      cascadeLayer: "tokens",
      attribute: false,
      system: { dark: "(prefers-color-scheme: dark)" },
    } as const;

    expect(orThrow(exportCssVars(singleTokenLightDark(), options)).css).toBe(
      [
        "@layer tokens {",
        "  :where(:root) {",
        "    --surface: #ffffff;",
        "  }",
        "",
        "  @media (prefers-color-scheme: dark) {",
        "    :where(:root) {",
        "      --surface: #000000;",
        "    }",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(
      orThrow(exportCssVars(singleTokenLightDark(), { ...options, format: "compact" })).css,
    ).toBe(
      "@layer tokens{:where(:root){--surface:#ffffff;}" +
        "@media (prefers-color-scheme: dark){:where(:root){--surface:#000000;}}}",
    );
    expect(
      orThrow(
        exportCssVars(singleModeScheme(), { cascadeLayer: "app.tokens-v2", format: "compact" }),
      ).css,
    ).toBe("@layer app.tokens-v2{:where(:root){--background:#ffffff;}}");
  });

  test("the CSS is exactly the structured blocks, with no exclusions or importance", () => {
    const exported = orThrow(
      exportCssVars(threeModeScheme(), {
        root: ":host",
        cascadeLayer: "tokens",
        system: { dark: "(prefers-color-scheme: dark)" },
        selectors: {
          light: ".light",
          dark: [{ selector: ".dark", media: "screen" }, { selector: "[data-contrast] .dark" }],
        },
      }),
    );

    expect(exported.css).toBe(`@layer tokens {\n${formatBlocks(exported.blocks, 1)}\n}\n`);
    expect(exported.css).not.toMatch(/important|:not\(/u);
    for (const block of exported.blocks) {
      expect(Object.keys(block)).toEqual(
        block.media === undefined
          ? ["tier", "mode", "selectors", "declarations"]
          : ["tier", "mode", "selectors", "media", "declarations"],
      );
    }
  });

  test("overlapping and identical custom conditions are deterministic data, not errors", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), {
        attribute: false,
        selectors: { light: ".theme", dark: ".theme" },
      }),
    );

    expect(summarize(exported.blocks).slice(1)).toEqual([
      ["custom", "light", [".theme"], undefined],
      ["custom", "dark", [".theme"], undefined],
    ]);
  });

  test("dynamic parsed schemes keep authored order and accept conditions for their modes", () => {
    const parsed = orThrow(
      parseCompiledScheme(JSON.parse(serializeCompiledScheme(threeModeScheme())) as unknown),
    );
    const exported = orThrow(
      exportCssVars(parsed, { attribute: false, system: { sepia: "print" } }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["base", "light", [":root"], undefined],
      ["system", "sepia", [":root"], "print"],
    ]);
  });
});

describe("CSS activation options", () => {
  test("explicit undefined options mean omitted options", () => {
    expect(
      exportCssVars(lightDarkScheme(), {
        prefix: undefined,
        root: undefined,
        attribute: undefined,
        system: { dark: undefined },
        selectors: { light: undefined },
        cascadeLayer: undefined,
        format: undefined,
      } as never),
    ).toEqual(exportCssVars(lightDarkScheme()));
  });

  test("the superseded selector options are unknown, each reported", () => {
    const result = exportCssVars(lightDarkScheme(), {
      scope: { strategy: "root" },
      modeSelectors: { strategy: "class", classPrefix: "theme-" },
      classPrefix: "theme-",
    } as never);

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-options", option: "classPrefix" },
        { code: "invalid-css-options", option: "modeSelectors" },
        { code: "invalid-css-options", option: "scope" },
      ],
    });
  });

  test("every independent option failure is collected in option-name order", () => {
    const result = exportCssVars(lightDarkScheme(), {
      variableName: "--x",
      system: { dark: "(prefers-color-scheme: dark", sepia: "print" },
      selectors: { light: ".ok", dark: ".a{", sepia: ".s" },
      root: ":root > ",
      prefix: "App",
      format: "minified",
      cascadeLayer: "revert",
      attribute: "theme",
      unknown: true,
    } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: "invalid-attribute" }),
        expect.objectContaining({ code: "invalid-cascade-layer" }),
        expect.objectContaining({ code: "invalid-css-options", option: "format" }),
        expect.objectContaining({ code: "invalid-css-prefix" }),
        expect.objectContaining({ code: "invalid-root", selector: ":root > " }),
        expect.objectContaining({
          code: "invalid-selector",
          tier: "custom",
          mode: "dark",
          selector: ".a{",
        }),
        expect.objectContaining({ code: "unknown-condition-mode", tier: "custom", mode: "sepia" }),
        expect.objectContaining({
          code: "invalid-media",
          tier: "system",
          mode: "dark",
          media: "(prefers-color-scheme: dark",
        }),
        expect.objectContaining({ code: "unknown-condition-mode", tier: "system", mode: "sepia" }),
        expect.objectContaining({ code: "invalid-css-options", option: "unknown" }),
        expect.objectContaining({ code: "invalid-css-options", option: "variableName" }),
      ],
    });
  });

  test("options and condition maps must be plain data, read without invoking accessors", () => {
    let reads = 0;
    const hostile = {
      get prefix() {
        reads += 1;
        return "app";
      },
    };

    expect(exportCssVars(lightDarkScheme(), hostile as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-css-options" }],
    });
    expect(exportCssVars(lightDarkScheme(), [] as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-css-options" }],
    });
    expect(
      exportCssVars(lightDarkScheme(), {
        system: new Map() as never,
        selectors: "dark" as never,
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-options", option: "selectors" },
        { code: "invalid-css-options", option: "system" },
      ],
    });
    expect(reads).toBe(0);
  });

  test("custom condition shapes are validated per mode and per condition index", () => {
    const result = exportCssVars(threeModeScheme(), {
      selectors: {
        dark: [
          { selector: ".ok" },
          { selector: 42 },
          { media: "print" },
          { selector: ".x", media: "tv", extra: true },
          "not an object",
        ],
        light: [],
        sepia: 7,
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        // A non-string selector is not echoed back in `selector`.
        {
          code: "invalid-selector",
          message: expect.any(String),
          tier: "custom",
          mode: "dark",
          index: 1,
        },
        expect.objectContaining({ code: "invalid-custom-condition", mode: "dark", index: 2 }),
        expect.objectContaining({ code: "invalid-custom-condition", mode: "dark", index: 3 }),
        expect.objectContaining({
          code: "invalid-media",
          tier: "custom",
          mode: "dark",
          index: 3,
          media: "tv",
        }),
        expect.objectContaining({ code: "invalid-custom-condition", mode: "dark", index: 4 }),
        expect.objectContaining({ code: "invalid-custom-condition", mode: "light" }),
        expect.objectContaining({ code: "invalid-custom-condition", mode: "sepia" }),
      ],
    });
  });

  test("compiled-scheme issues are returned unchanged before options are read", () => {
    expect(exportCssVars({} as never, { unknown: true } as never)).toEqual(parseCompiledScheme({}));
  });
});

type BlockSummary = readonly [string, string, readonly string[], string | undefined];

function summarize(blocks: readonly CssVarBlock[]): readonly BlockSummary[] {
  return blocks.map((block) => [block.tier, block.mode, block.selectors, block.media]);
}

function customModes(blocks: readonly CssVarBlock[]): readonly string[] {
  return blocks.filter((block) => block.tier === "custom").map((block) => block.mode);
}

// Rebuilds pretty CSS from structured blocks alone, the way an application would re-emit them.
function formatBlocks(blocks: readonly CssVarBlock[], depth: number): string {
  const pad = (level: number) => "  ".repeat(level);
  return blocks
    .map((block) => {
      const level = block.media === undefined ? depth : depth + 1;
      const rule = [
        `${pad(level)}:where(${block.selectors.join(", ")}) {`,
        ...block.declarations.map(
          (declaration) => `${pad(level + 1)}${declaration.property}: ${declaration.value};`,
        ),
        `${pad(level)}}`,
      ];
      return (
        block.media === undefined
          ? rule
          : [`${pad(depth)}@media ${block.media} {`, ...rule, `${pad(depth)}}`]
      ).join("\n");
    })
    .join("\n\n");
}

function singleModeScheme() {
  return orThrow(compileTokenGraph(defineTokenGraph({ tokens: { background: "#ffffff" } })));
}

function lightDarkScheme() {
  return orThrow(
    compileTokenGraph(
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: {
          background: { light: "#ffffff", dark: "#111111" },
          foreground: { light: "#111111", dark: "#eeeeee" },
        },
      }),
    ),
  );
}

function singleTokenLightDark() {
  return orThrow(
    compileTokenGraph(
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        tokens: { surface: { light: "#ffffff", dark: "#000000" } },
      }),
    ),
  );
}

function threeModeScheme() {
  return orThrow(
    compileTokenGraph(
      defineTokenGraph({
        modes: ["dark", "light", "sepia"],
        defaultMode: "light",
        tokens: { background: { dark: "#111111", light: "#ffffff", sepia: "#f4ecd8" } },
      }),
    ),
  );
}
