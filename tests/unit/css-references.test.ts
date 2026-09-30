import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  parseCompiledScheme,
  tokenConcat,
  tokenRef,
  type CssVarsExport,
} from "../../src";

// Captured by building and executing the P4 parent, never the current exporter.
const p4Output = JSON.parse(
  readFileSync(new URL("../fixtures/css-reference-p4-output.json", import.meta.url), "utf8"),
) as { readonly sourceSha: string; readonly pretty: string; readonly compact: string };

describe("CSS reference projection", () => {
  const graph = defineTokenGraph({
    tokens: {
      "a.alias": tokenRef("z.target"),
      "b.private-alias": tokenRef("private"),
      private: { value: "8px", visibility: "internal" },
      "z.target": "20px",
    },
  });

  test("public references link only to emitted direct targets", () => {
    const scheme = orThrow(compileTokenGraph(graph));
    const before = structuredClone(scheme);
    const exported = orThrow(exportCssVars(scheme, { references: "var" }));

    expect(values(exported)).toEqual({
      "a.alias": "var(--z-target)",
      "b.private-alias": "8px",
      "z.target": "20px",
    });
    expect(exported.blocks[0]?.declarations.map((declaration) => declaration.tokenKey)).toEqual([
      "a.alias",
      "b.private-alias",
      "z.target",
    ]);
    expect(scheme).toEqual(before);
    expect(exported.variableByToken).not.toHaveProperty("private");
  });

  test("all selection links a selected internal target", () => {
    const exported = orThrow(
      exportCssVars(orThrow(compileTokenGraph(graph, { selection: "all" })), { references: "var" }),
    );
    expect(values(exported)["b.private-alias"]).toBe("var(--private)");
    expect(values(exported).private).toBe("8px");
  });

  test("exact selection governs links independently of public visibility", () => {
    const omitted = orThrow(compileTokenGraph(graph, { selection: { keys: ["a.alias"] } }));
    const included = orThrow(
      compileTokenGraph(graph, { selection: { keys: ["a.alias", "z.target"] } }),
    );
    expect(values(orThrow(exportCssVars(omitted, { references: "var" })))).toEqual({
      "a.alias": "20px",
    });
    expect(values(orThrow(exportCssVars(included, { references: "var" })))["a.alias"]).toBe(
      "var(--z-target)",
    );
  });

  test("an omitted intermediate is inlined rather than bypassed", () => {
    const chain = defineTokenGraph({ tokens: { a: tokenRef("b"), b: tokenRef("c"), c: "20px" } });
    const scheme = orThrow(compileTokenGraph(chain, { selection: { keys: ["a", "c"] } }));
    expect(values(orThrow(exportCssVars(scheme, { references: "var" })))).toEqual({
      a: "20px",
      c: "20px",
    });
    expect(
      values(orThrow(exportCssVars(orThrow(compileTokenGraph(chain)), { references: "var" }))),
    ).toEqual({ a: "var(--b)", b: "var(--c)", c: "20px" });
  });

  test("concat links and inlines each part independently, retaining repeated references", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            spacing: "20px",
            private: { value: "3px", visibility: "internal" },
            width: tokenConcat`calc(${tokenRef("spacing")} + ${tokenRef("private")} + ${tokenRef("spacing")})`,
          },
        }),
      ),
    );
    expect(values(orThrow(exportCssVars(scheme, { references: "var" })))).toEqual({
      spacing: "20px",
      width: "calc(var(--spacing) + 3px + var(--spacing))",
    });
    expect(values(orThrow(exportCssVars(scheme))).width).toBe("calc(20px + 3px + 20px)");
    expect(exportCssVars(scheme, { references: "resolved" })).toEqual(exportCssVars(scheme));
  });

  test("sparse expressions are literal, reference, or concat independently per mode", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["light", "dark", "concat"],
          defaultMode: "light",
          tokens: {
            target: { light: "10px", dark: "20px", concat: "30px" },
            alias: {
              light: "5px",
              dark: tokenRef("target"),
              concat: tokenConcat`calc(${tokenRef("target")} * 2)`,
            },
            opaque: "var(--authored-name, 7px)",
          },
        }),
      ),
    );
    const exported = orThrow(exportCssVars(scheme, { references: "var", prefix: "app" }));
    expect(values(exported, "light").alias).toBe("5px");
    expect(values(exported, "dark").alias).toBe("var(--app-target)");
    expect(values(exported, "concat").alias).toBe("calc(var(--app-target) * 2)");
    for (const mode of scheme.modes) {
      expect(values(exported, mode).opaque).toBe("var(--authored-name, 7px)");
    }
    expect(scheme.metadataByToken.alias.expressionByMode).not.toHaveProperty("light");
  });

  test("inherited object properties are not emitted targets or retained expressions", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["constructor", "dark"],
          defaultMode: "constructor",
          tokens: {
            constructor: { value: "20px", visibility: "internal" },
            alias: { constructor: "10px", dark: tokenRef("constructor") },
          },
        }),
      ),
    );
    const exported = orThrow(exportCssVars(scheme, { references: "var" }));
    expect(values(exported, "constructor")).toEqual({ alias: "10px" });
    expect(values(exported, "dark")).toEqual({ alias: "20px" });
  });
});

describe("reference names and declaration fidelity", () => {
  test("links reuse actual prefix/custom names, with one callback per selected key in canonical order", () => {
    const graph = defineTokenGraph({
      tokens: {
        "z.target": "20px",
        omitted: "3px",
        "a.alias": tokenRef("z.target"),
        "b.width": tokenConcat`calc(${tokenRef("z.target")} + ${tokenRef("omitted")} + ${tokenRef("z.target")})`,
      },
    });
    const scheme = orThrow(
      compileTokenGraph(graph, { selection: { keys: ["z.target", "b.width", "a.alias"] } }),
    );
    const calls: string[] = [];
    const exported = orThrow(
      exportCssVars(scheme, {
        references: "var",
        prefix: "app",
        variableName({ tokenKey, defaultName, prefix }) {
          calls.push(tokenKey);
          expect(prefix).toBe("app");
          return tokenKey === "z.target" ? "--custom-target" : defaultName;
        },
      }),
    );
    expect(calls).toEqual(["a.alias", "b.width", "z.target"]);
    expect(values(exported)).toEqual({
      "a.alias": "var(--custom-target)",
      "b.width": "calc(var(--custom-target) + 3px + var(--custom-target))",
      "z.target": "20px",
    });
    expect(
      values(orThrow(exportCssVars(scheme, { references: "var", prefix: "app" })))["a.alias"],
    ).toBe("var(--app-z-target)");
  });

  test.each(["throw", "invalid", "collision"] as const)(
    "a selected target name %s fails without inlining or extra value issues",
    (failure) => {
      const scheme = orThrow(
        compileTokenGraph(
          defineTokenGraph({
            tokens: {
              alias: tokenRef("constructor"),
              assembly: tokenConcat`/${tokenRef("constructor")}`,
              constructor: "*",
            },
          }),
        ),
      );
      const calls: string[] = [];
      const result = exportCssVars(scheme, {
        references: "var",
        variableName({ tokenKey, defaultName }) {
          calls.push(tokenKey);
          if (tokenKey !== "constructor") {
            return defaultName;
          }
          if (failure === "throw") {
            throw new Error("naming failed");
          }
          return failure === "invalid" ? "--bad);color:red;(" : "--alias";
        },
      });
      // Inlining a failed target name would make assembly's unused resolved "/*" unsafe.
      expect(calls).toEqual(["alias", "assembly", "constructor"]);
      expect(result).toEqual({
        ok: false,
        issues: [
          expect.objectContaining({
            code: failure === "collision" ? "duplicate-css-variable" : "invalid-css-variable",
            key: "constructor",
          }),
        ],
      });
    },
  );

  test("all name failures and independent projected literal/fallback failures are collected", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            "a.alias": tokenRef("z.target"),
            "b.literal": "red;",
            "c.concat": tokenConcat`calc(${tokenRef("z.target")} + ${tokenRef("private")})`,
            private: { value: "3px;", visibility: "internal" },
            "y.other": "10px",
            "z.target": "20px",
          },
        }),
      ),
    );
    const result = exportCssVars(scheme, {
      references: "var",
      variableName({ tokenKey, defaultName }) {
        if (tokenKey === "z.target") {
          return "--invalid;";
        }
        return tokenKey === "y.other" ? "--a-alias" : defaultName;
      },
    });
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "duplicate-css-variable",
          key: "y.other",
          firstKey: "a.alias",
        }),
        expect.objectContaining({ code: "invalid-css-variable", key: "z.target" }),
        expect.objectContaining({
          code: "invalid-css-value",
          key: "b.literal",
          mode: "base",
          path: "/tokens/b.literal/base",
        }),
        expect.objectContaining({
          code: "invalid-css-value",
          key: "c.concat",
          mode: "base",
          path: "/metadataByToken/c.concat/expressionByMode/base",
        }),
      ],
    });
  });

  test.each(["pretty", "compact"] as const)(
    "%s CSS uses the exact structured projected values and complete declarations in every tier",
    (format) => {
      const scheme = orThrow(
        compileTokenGraph(
          defineTokenGraph({
            modes: ["dark", "light"],
            defaultMode: "light",
            tokens: {
              "a.alias": tokenRef("z.target"),
              "z.target": { light: "10px", dark: "20px" },
            },
          }),
        ),
      );
      const options = {
        format,
        cascadeLayer: "tokens",
        root: ":host",
        system: { dark: "screen" },
        selectors: { dark: [{ selector: ".dark", media: "print" }, { selector: ".night" }] },
      } as const;
      const resolved = orThrow(exportCssVars(scheme, options));
      expect(p4Output.sourceSha).toBe("05ebcdf4cdf655b5545e81ef42d77a90ddc11116");
      const expectedCss = p4Output[format];
      expect(resolved.css).toBe(expectedCss);
      // @ts-expect-error strict optional properties exclude undefined; verify the runtime default.
      expect(orThrow(exportCssVars(scheme, { ...options, references: undefined })).css).toBe(
        expectedCss,
      );
      expect(orThrow(exportCssVars(scheme, { ...options, references: "resolved" })).css).toBe(
        expectedCss,
      );
      const exported = orThrow(exportCssVars(scheme, { ...options, references: "var" }));
      expect(
        exported.blocks.map(({ declarations: _declarations, ...activation }) => activation),
      ).toEqual(
        resolved.blocks.map(({ declarations: _declarations, ...activation }) => activation),
      );
      expect(exported.variableByToken).toEqual(resolved.variableByToken);
      for (const block of exported.blocks) {
        expect(block.declarations.map((declaration) => declaration.tokenKey)).toEqual([
          "a.alias",
          "z.target",
        ]);
        expect(block.declarations[0]?.value).toBe("var(--z-target)");
      }
      // Projection changes only the alias value in the independently captured P4 text.
      expect(exported.css).toBe(
        expectedCss.replaceAll(/(--a-alias:\s*)(10px|20px);/gu, "$1var(--z-target);"),
      );
      for (const block of exported.blocks) {
        for (const { property, value } of block.declarations) {
          expect(exported.css).toContain(`${property}:${format === "pretty" ? " " : ""}${value};`);
        }
      }
    },
  );
});

describe("projected declaration safety", () => {
  test("balanced concat is checked as a complete value, including incomplete fallback fragments", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            start: { value: "calc(", visibility: "internal" },
            end: { value: ")", visibility: "internal" },
            spacing: "20px",
            width: tokenConcat`${tokenRef("start")}${tokenRef("spacing")} * 2${tokenRef("end")}`,
          },
        }),
      ),
    );
    expect(values(orThrow(exportCssVars(scheme, { references: "var" }))).width).toBe(
      "calc(var(--spacing) * 2)",
    );
  });

  test("safe projection does not validate an unused resolved value", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          tokens: {
            star: "*",
            alias: tokenConcat`/${tokenRef("star")}`,
          },
        }),
      ),
    );
    expect(scheme.tokens.alias.base).toBe("/*");
    expect(exportCssVars(scheme)).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-value", path: "/tokens/alias/base", key: "alias", mode: "base" },
      ],
    });
    expect(values(orThrow(exportCssVars(scheme, { references: "var" })))).toEqual({
      alias: "/var(--star)",
      star: "*",
    });
  });

  test("an emitted target's standalone declaration is still checked", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({ tokens: { target: "red;", alias: tokenRef("target") } }),
      ),
    );
    expect(exportCssVars(scheme, { references: "var" })).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "invalid-css-value",
          key: "target",
          mode: "base",
          path: "/tokens/target/base",
        }),
      ],
    });
    expect(
      exportCssVars(
        orThrow(
          compileTokenGraph(
            defineTokenGraph({ tokens: { target: "red;", alias: tokenRef("target") } }),
            { selection: { keys: ["alias"] } },
          ),
        ),
        { references: "var" },
      ),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-css-value", key: "alias", path: "/tokens/alias/base" }],
    });
  });

  test.each(["/*", ");color:red;("])(
    "unsafe literal/fallback assembly %j is blamed on the complete retained expression",
    (unsafe) => {
      const graph = defineTokenGraph({
        tokens: {
          fallback: { value: unsafe.slice(1), visibility: "internal" },
          alias: { concat: [unsafe[0] as string, tokenRef("fallback")] },
        },
      });
      const scheme = orThrow(compileTokenGraph(graph));
      expect(exportCssVars(scheme, { references: "var" })).toEqual({
        ok: false,
        issues: [
          expect.objectContaining({
            code: "invalid-css-value",
            key: "alias",
            mode: "base",
            path: "/metadataByToken/alias/expressionByMode/base",
          }),
        ],
      });
    },
  );

  test("structural parsing does not prove retained metadata matches tokens, but emitted strings are checked", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({ tokens: { target: "20px", alias: tokenRef("target") } }),
      ),
    );
    const edited = {
      ...scheme,
      metadataByToken: {
        ...scheme.metadataByToken,
        alias: {
          ...scheme.metadataByToken.alias,
          expressionByMode: { base: { concat: ["calc(", { ref: "target", value: "unused;" }] } },
        },
      },
    } as const;
    expect(parseCompiledScheme(edited).ok).toBe(true);
    expect(exportCssVars(edited).ok).toBe(true);
    expect(exportCssVars(edited, { references: "var" })).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "invalid-css-value",
          key: "alias",
          mode: "base",
          path: "/metadataByToken/alias/expressionByMode/base",
        }),
      ],
    });
    const safe = {
      ...edited,
      metadataByToken: {
        ...edited.metadataByToken,
        alias: {
          ...edited.metadataByToken.alias,
          expressionByMode: {
            base: { concat: ["calc(", { ref: "target", value: "unused;" }, " * 2)"] },
          },
        },
      },
    } as const;
    expect(values(orThrow(exportCssVars(safe, { references: "var" }))).alias).toBe(
      "calc(var(--target) * 2)",
    );
    const cycle = {
      ...scheme,
      metadataByToken: {
        ...scheme.metadataByToken,
        alias: { ...scheme.metadataByToken.alias, expressionByMode: { base: { ref: "alias" } } },
      },
    } as const;
    expect(values(orThrow(exportCssVars(cycle, { references: "var" }))).alias).toBe("var(--alias)");
  });

  test("pure references use their own resolved value for omitted targets, even in edited metadata", () => {
    const scheme = orThrow(compileTokenGraph(defineTokenGraph({ tokens: { alias: "red;" } })));
    const edited = {
      ...scheme,
      metadataByToken: {
        alias: { ...scheme.metadataByToken.alias, expressionByMode: { base: { ref: "missing" } } },
      },
    } as const;
    expect(exportCssVars(edited, { references: "var" })).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-css-value", key: "alias", mode: "base", path: "/tokens/alias/base" },
      ],
    });
  });

  test("each emitted key/mode is checked once and modes without activation are ignored", () => {
    const scheme = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["light", "dark", "unused"],
          defaultMode: "light",
          tokens: {
            target: "20px",
            width: {
              light: tokenConcat`calc(${tokenRef("target")}`,
              dark: tokenConcat`${tokenRef("target")};`,
              unused: tokenConcat`[${tokenRef("target")}`,
            },
          },
        }),
      ),
    );
    const options = {
      references: "var",
      attribute: false,
      selectors: {
        light: [{ selector: ".light" }, { selector: ".day", media: "screen" }],
        dark: ".dark",
      },
    } as const;
    expect(exportCssVars(scheme, options)).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: "invalid-css-value",
          key: "width",
          mode: "light",
          path: "/metadataByToken/width/expressionByMode/light",
        }),
        expect.objectContaining({
          code: "invalid-css-value",
          key: "width",
          mode: "dark",
          path: "/metadataByToken/width/expressionByMode/dark",
        }),
      ],
    });
    const { light: _light, ...inactiveExpressions } =
      scheme.metadataByToken.width.expressionByMode ?? {};
    const onlySafeMode = {
      ...scheme,
      tokens: { ...scheme.tokens, width: { ...scheme.tokens.width, light: "40px" } },
      metadataByToken: {
        ...scheme.metadataByToken,
        width: {
          ...scheme.metadataByToken.width,
          expressionByMode: inactiveExpressions,
        },
      },
    };
    expect(exportCssVars(onlySafeMode, { references: "var", attribute: false }).ok).toBe(true);
    const malformed = {
      ...scheme,
      metadataByToken: {
        ...scheme.metadataByToken,
        width: { ...scheme.metadataByToken.width, expressionByMode: { unused: { concat: [] } } },
      },
    };
    const parsed = parseCompiledScheme(malformed);
    expect(parsed).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid-expression", path: "/metadataByToken/width/expressionByMode/unused" },
      ],
    });
    expect(exportCssVars(malformed as never, { references: "bad" } as never)).toEqual(parsed);
  });
});

function values(
  exported: CssVarsExport<string, string, boolean>,
  mode = "base",
): Record<string, string> {
  const block = exported.blocks.find((candidate) => candidate.mode === mode);
  expect(block).toBeDefined();
  return Object.fromEntries(
    (block?.declarations ?? []).map(({ tokenKey, value }) => [tokenKey, value]),
  );
}
