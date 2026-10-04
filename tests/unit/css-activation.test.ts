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
  test.each(["pretty", "compact"] as const)(
    "explicit resolved output preserves the P4 %s activation fixture exactly",
    (format) => {
      const scheme = threeModeScheme();
      const options = {
        activation: {
          attribute: { name: "data-theme", includeHost: true },
          root: ":host",
          media: { dark: "(prefers-color-scheme: dark)", sepia: "print" },
          selectors: {
            light: ".light",
            dark: [{ selector: ".dark", media: "screen" }, { selector: ".night" }],
          },
        },
        format,
        prefix: "app",
        cascadeLayer: "tokens",
      } as const;
      expect(exportCssVars(scheme, { ...options, references: "resolved" })).toEqual(
        exportCssVars(scheme, options),
      );
      expect(exportCssVars(scheme, { ...options, references: undefined } as never)).toEqual(
        exportCssVars(scheme, options),
      );
    },
  );

  test("a one-mode scheme emits only the default block by default", () => {
    const exported = orThrow(exportCssVars(singleModeScheme()));

    expect(exported.css).toBe(":where(:root) {\n  --background: #ffffff;\n}\n");
    expect(exported.blocks).toEqual([
      {
        tier: "default",
        mode: "base",
        selectors: [":root"],
        declarations: [{ tokenKey: "background", property: "--background", value: "#ffffff" }],
      },
    ]);
    expect(exported.blocks[0]).not.toHaveProperty("media");
  });

  test("explicit attribute activation emits markers for every mode, the default included", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), { activation: { attribute: "data-theme" } }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", [":root"], undefined],
      ["attribute", "light", ['[data-theme="light"]'], undefined],
      ["attribute", "dark", ['[data-theme="dark"]'], undefined],
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

  test("tiers are default, media, attribute, then selector; within a tier, authored mode order", () => {
    const scheme = threeModeScheme();
    const exported = orThrow(
      exportCssVars(scheme, {
        activation: {
          attribute: "data-theme",
          media: { sepia: "(min-width: 48rem)", dark: "(prefers-color-scheme: dark)" },
          selectors: {
            sepia: ".sepia",
            dark: [{ selector: ".dark" }, { selector: ".night", media: "print" }],
          },
        },
      }),
    );

    // Authored order is dark, light, sepia; the default (light) is not moved first.
    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", [":root"], undefined],
      ["media", "dark", [":root"], "(prefers-color-scheme: dark)"],
      ["media", "sepia", [":root"], "(min-width: 48rem)"],
      ["attribute", "dark", ['[data-theme="dark"]'], undefined],
      ["attribute", "light", ['[data-theme="light"]'], undefined],
      ["attribute", "sepia", ['[data-theme="sepia"]'], undefined],
      ["selector", "dark", [".dark"], undefined],
      ["selector", "dark", [".night"], "print"],
      ["selector", "sepia", [".sepia"], undefined],
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
    const options = { activation: { selectors: { dark: ".dark", sepia: ".sepia" } } } as const;
    const permutedOptions = {
      activation: { selectors: { sepia: ".sepia", dark: ".dark" } },
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
        activation: { selectors: { dark: [{ selector: ".b" }, { selector: ".a" }] } },
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
        activation: {
          attribute: "data-theme",
          media: { dark: "(prefers-color-scheme: dark)" },
          selectors: { light: ".light", dark: [{ selector: ".dark" }, { selector: ".dim" }] },
        },
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

  test("omitting activation.attribute emits no markers and keeps selector conditions", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), { activation: { selectors: { dark: ".dark" } } }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", [":root"], undefined],
      ["selector", "dark", [".dark"], undefined],
    ]);
  });

  test("explicit attribute activation applies to both one-mode and multi-mode schemes", () => {
    expect(
      summarize(
        orThrow(exportCssVars(singleModeScheme(), { activation: { attribute: "data-mode" } }))
          .blocks,
      ),
    ).toEqual([
      ["default", "base", [":root"], undefined],
      ["attribute", "base", ['[data-mode="base"]'], undefined],
    ]);
    expect(
      orThrow(
        exportCssVars(lightDarkScheme(), { activation: { attribute: "data-color-scheme" } }),
      ).blocks.map((block) => block.selectors[0]),
    ).toEqual([":root", '[data-color-scheme="light"]', '[data-color-scheme="dark"]']);
  });

  test("attribute markers stay unanchored for any activation.root", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), { activation: { root: "#app", attribute: "data-theme" } }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", ["#app"], undefined],
      ["attribute", "light", ['[data-theme="light"]'], undefined],
      ["attribute", "dark", ['[data-theme="dark"]'], undefined],
    ]);
  });

  test("a :host root targets default and media blocks; includeHost adds host attribute matching", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), {
        activation: {
          attribute: { name: "data-theme", includeHost: true },
          root: ":host",
          media: { dark: "(prefers-color-scheme: dark)" },
        },
      }),
    );

    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", [":host"], undefined],
      ["media", "dark", [":host"], "(prefers-color-scheme: dark)"],
      ["attribute", "light", [':host([data-theme="light"])', '[data-theme="light"]'], undefined],
      ["attribute", "dark", [':host([data-theme="dark"])', '[data-theme="dark"]'], undefined],
    ]);
    expect(exported.css).toContain(":where(:host) {\n");
    expect(exported.css).toContain("@media (prefers-color-scheme: dark) {\n  :where(:host) {\n");
    expect(exported.css).toContain(':where(:host([data-theme="dark"]), [data-theme="dark"]) {\n');
  });

  test("pretty output nests media blocks and separates blocks with one blank line", () => {
    const exported = orThrow(
      exportCssVars(singleTokenLightDark(), {
        activation: {
          attribute: "data-theme",
          media: { dark: "(prefers-color-scheme: dark)" },
          selectors: {
            dark: [{ selector: ".dark, .night", media: "screen and (min-width: 48rem)" }],
          },
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
        activation: {
          attribute: { name: "data-theme", includeHost: true },
          root: ":host",
          media: { dark: "(prefers-color-scheme: dark)" },
          selectors: { dark: [{ selector: ".dark", media: "print" }] },
        },
        format: "compact",
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
      activation: { media: { dark: "(prefers-color-scheme: dark)" } },
      cascadeLayer: "tokens",
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
        activation: {
          attribute: { name: "data-theme", includeHost: true },
          root: ":host",
          media: { dark: "(prefers-color-scheme: dark)" },
          selectors: {
            light: ".light",
            dark: [{ selector: ".dark", media: "screen" }, { selector: "[data-contrast] .dark" }],
          },
        },
        cascadeLayer: "tokens",
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

  test("overlapping and identical selector conditions are deterministic data, not errors", () => {
    const exported = orThrow(
      exportCssVars(lightDarkScheme(), {
        activation: { selectors: { light: ".theme", dark: ".theme" } },
      }),
    );

    expect(summarize(exported.blocks).slice(1)).toEqual([
      ["selector", "light", [".theme"], undefined],
      ["selector", "dark", [".theme"], undefined],
    ]);
  });

  test("dynamic parsed schemes keep authored order and accept conditions for their modes", () => {
    const parsed = orThrow(
      parseCompiledScheme(JSON.parse(serializeCompiledScheme(threeModeScheme())) as unknown),
    );
    const exported = orThrow(exportCssVars(parsed, { activation: { media: { sepia: "print" } } }));

    expect(summarize(exported.blocks)).toEqual([
      ["default", "light", [":root"], undefined],
      ["media", "sepia", [":root"], "print"],
    ]);
  });
});

describe("CSS activation options", () => {
  test("explicit undefined options mean omitted options", () => {
    expect(
      exportCssVars(lightDarkScheme(), {
        activation: {
          root: undefined,
          attribute: undefined,
          media: { dark: undefined },
          selectors: { light: undefined },
        },
        prefix: undefined,
        references: undefined,
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
      activation: {
        media: { dark: "(prefers-color-scheme: dark", sepia: "print" },
        selectors: { light: ".ok", dark: ".a{", sepia: ".s" },
        root: ":root > ",
        attribute: "theme",
      },
      variableName: "--x",
      prefix: "App",
      references: "linked",
      format: "minified",
      cascadeLayer: "revert",
      unknown: true,
    } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: "invalid-attribute" }),
        expect.objectContaining({
          code: "invalid-media",
          tier: "media",
          mode: "dark",
          media: "(prefers-color-scheme: dark",
        }),
        expect.objectContaining({ code: "unknown-condition-mode", tier: "media", mode: "sepia" }),
        expect.objectContaining({ code: "invalid-root", selector: ":root > " }),
        expect.objectContaining({
          code: "invalid-selector",
          tier: "selector",
          mode: "dark",
          selector: ".a{",
        }),
        expect.objectContaining({
          code: "unknown-condition-mode",
          tier: "selector",
          mode: "sepia",
        }),
        expect.objectContaining({ code: "invalid-cascade-layer" }),
        expect.objectContaining({ code: "invalid-css-options", option: "format" }),
        expect.objectContaining({ code: "invalid-css-prefix" }),
        expect.objectContaining({ code: "invalid-css-options", option: "references" }),
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
        activation: { media: new Map() as never, selectors: "dark" as never },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-options", option: "activation.media" },
        { code: "invalid-css-options", option: "activation.selectors" },
      ],
    });
    expect(reads).toBe(0);
  });

  test.each([null, 42, true, {}, "linked"])(
    "an invalid references option %j uses the existing option diagnostic",
    (references) => {
      expect(exportCssVars(singleModeScheme(), { references } as never)).toEqual({
        ok: false,
        issues: [
          { code: "invalid-css-options", option: "references", message: expect.any(String) },
        ],
      });
    },
  );

  test("selector condition shapes are validated per mode and per condition index", () => {
    const result = exportCssVars(threeModeScheme(), {
      activation: {
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
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        // A non-string selector is not echoed back in `selector`.
        {
          code: "invalid-selector",
          message: expect.any(String),
          tier: "selector",
          mode: "dark",
          index: 1,
        },
        expect.objectContaining({ code: "invalid-selector-condition", mode: "dark", index: 2 }),
        expect.objectContaining({ code: "invalid-selector-condition", mode: "dark", index: 3 }),
        expect.objectContaining({
          code: "invalid-media",
          tier: "selector",
          mode: "dark",
          index: 3,
          media: "tv",
        }),
        expect.objectContaining({ code: "invalid-selector-condition", mode: "dark", index: 4 }),
        expect.objectContaining({ code: "invalid-selector-condition", mode: "light" }),
        expect.objectContaining({ code: "invalid-selector-condition", mode: "sepia" }),
      ],
    });
  });

  test("a missing selector condition does not skip invalid sibling media", () => {
    // Deliberately bypass authoring types to exercise untrusted JavaScript input.
    const media = "not valid media !!!";
    const result = exportCssVars(lightDarkScheme(), {
      activation: { selectors: { dark: [{ media }] } },
    } as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "invalid-selector-condition",
          message: expect.any(String),
          tier: "selector",
          mode: "dark",
          index: 0,
        },
        {
          code: "invalid-media",
          message: expect.any(String),
          tier: "selector",
          mode: "dark",
          index: 0,
          media,
        },
      ],
    });
  });

  test("unknown condition properties, missing selector, and invalid media collect in stable order", () => {
    const media = "not valid media !!!";
    const options = { activation: { selectors: { dark: [{ media, extra: true }] } } };
    const result = exportCssVars(lightDarkScheme(), options as never);

    expect(result).toEqual({
      ok: false,
      issues: [
        // Unknown properties are collected first, then selector, then media failures.
        {
          code: "invalid-selector-condition",
          message: expect.stringContaining("extra"),
          tier: "selector",
          mode: "dark",
          index: 0,
        },
        {
          code: "invalid-selector-condition",
          message: expect.any(String),
          tier: "selector",
          mode: "dark",
          index: 0,
        },
        {
          code: "invalid-media",
          message: expect.any(String),
          tier: "selector",
          mode: "dark",
          index: 0,
          media,
        },
      ],
    });
    expect(
      exportCssVars(lightDarkScheme(), {
        activation: { selectors: { dark: [{ extra: true, media }] } },
      } as never),
    ).toEqual(result);
  });

  test("an invalid selector condition does not skip invalid sibling media", () => {
    expect(
      exportCssVars(lightDarkScheme(), {
        activation: { selectors: { dark: [{ selector: ".a{", media: "tv" }] } },
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-selector", tier: "selector", mode: "dark", index: 0, selector: ".a{" },
        { code: "invalid-media", tier: "selector", mode: "dark", index: 0, media: "tv" },
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
  return blocks.filter((block) => block.tier === "selector").map((block) => block.mode);
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

describe("explicit activation contracts", () => {
  test("omitted activation never invents attribute markers for any mode count", () => {
    for (const scheme of [singleModeScheme(), lightDarkScheme(), threeModeScheme()]) {
      const exported = orThrow(exportCssVars(scheme));
      expect(exported.blocks).toHaveLength(1);
      expect(exported.blocks[0]?.tier).toBe("default");
      expect(exported.css).not.toContain("data-theme");
    }
  });
  test.each([":root", ":host", ":host(.app)", "#app", ".theme-root"])(
    "root %s never changes attribute targeting",
    (root) => {
      for (const includeHost of [false, true]) {
        const activation = { root, attribute: { name: "data-mode", includeHost } };
        const exported = orThrow(exportCssVars(lightDarkScheme(), { activation }));
        expect(exported.blocks[0]?.selectors).toEqual([root]);
        expect(exported.blocks[2]?.selectors).toEqual(
          includeHost
            ? [':host([data-mode="dark"])', '[data-mode="dark"]']
            : ['[data-mode="dark"]'],
        );
      }
    },
  );
  test("ordinary attribute shorthand equals an explicit false flag", () => {
    expect(exportCssVars(lightDarkScheme(), { activation: { attribute: "data-mode" } })).toEqual(
      exportCssVars(lightDarkScheme(), {
        activation: { attribute: { name: "data-mode", includeHost: false } },
      }),
    );
  });
  test("one condition object normalizes like a one-item list", () => {
    const condition = { selector: ".dark", media: "(prefers-contrast: more)" };
    expect(
      exportCssVars(lightDarkScheme(), { activation: { selectors: { dark: condition } } }),
    ).toEqual(
      exportCssVars(lightDarkScheme(), { activation: { selectors: { dark: [condition] } } }),
    );
    expect(
      exportCssVars(lightDarkScheme(), {
        activation: { selectors: { dark: { media: "tv" } } },
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-selector-condition", mode: "dark", tier: "selector" },
        { code: "invalid-media", mode: "dark", tier: "selector" },
      ],
    });
  });
  test.each([
    false,
    true,
    {},
    { name: "theme" },
    { name: "data-mode", includeHost: "true" },
    { name: "data-mode", host: true },
  ])("rejects invalid attribute settings %j", (attribute) => {
    expect(exportCssVars(lightDarkScheme(), { activation: { attribute } } as never)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-attribute" }],
    });
  });
  test("activation and attribute records reject accessors without executing them", () => {
    let reads = 0;
    const hostile = {
      get name() {
        reads += 1;
        return "data-mode";
      },
    };
    expect(exportCssVars(lightDarkScheme(), { activation: { attribute: hostile } }).ok).toBe(false);
    expect(
      exportCssVars(lightDarkScheme(), {
        activation: Object.defineProperty({}, "root", {
          enumerable: true,
          get() {
            reads += 1;
            return ":root";
          },
        }),
      }).ok,
    ).toBe(false);
    expect(reads).toBe(0);
  });
  test("old top-level activation spellings and unrelated nested concerns are rejected", () => {
    expect(
      exportCssVars(lightDarkScheme(), {
        root: ":root",
        attribute: "data-mode",
        system: {},
        selectors: {},
      } as never),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-options", option: "attribute" },
        { code: "invalid-css-options", option: "root" },
        { code: "invalid-css-options", option: "selectors" },
        { code: "invalid-css-options", option: "system" },
      ],
    });
    expect(
      exportCssVars(lightDarkScheme(), { activation: { prefix: "app", system: {} } } as never),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-options", option: "activation.prefix" },
        { code: "invalid-css-options", option: "activation.system" },
      ],
    });
  });
});
