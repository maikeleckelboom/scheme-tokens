import { describe, expect, test } from "vitest";
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "../../src";

describe("CSS variable names", () => {
  test("default names join the prefix and token segments with single hyphens", () => {
    const scheme = compile({
      "a.b": "1",
      "action.primary.background": "2",
      "md.sys.color.on-primary": "3",
      "brand.600": "4",
      surface: "5",
    });

    expect(orThrow(exportCssVars(scheme)).variableByToken).toEqual({
      "a.b": "--a-b",
      "action.primary.background": "--action-primary-background",
      "brand.600": "--brand-600",
      "md.sys.color.on-primary": "--md-sys-color-on-primary",
      surface: "--surface",
    });
    expect(orThrow(exportCssVars(scheme, { prefix: "app" })).variableByToken).toMatchObject({
      "a.b": "--app-a-b",
      "action.primary.background": "--app-action-primary-background",
      surface: "--app-surface",
    });
  });

  test("a default-name collision fails with both keys and the shared variable", () => {
    const result = exportCssVars(compile({ "a.b-c": "second", "a-b.c": "first" }));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: "duplicate-css-variable",
          message: 'Tokens "a-b.c" and "a.b-c" both map to the CSS variable --a-b-c.',
          key: "a.b-c",
          firstKey: "a-b.c",
          property: "--a-b-c",
        },
      ],
    });
  });

  test("every collision is collected; the first key is first in code-unit order", () => {
    const result = exportCssVars(
      compile({
        "x.y-z": "1",
        "a.b-c": "2",
        "x-y.z": "3",
        "a-b.c": "4",
        "a-b-c": "5",
        unique: "6",
      }),
      { prefix: "app" },
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [
        {
          code: "duplicate-css-variable",
          key: "a-b.c",
          firstKey: "a-b-c",
          property: "--app-a-b-c",
          message: expect.stringMatching(/"a-b-c".*"a-b\.c".*--app-a-b-c/u),
        },
        {
          code: "duplicate-css-variable",
          key: "a.b-c",
          firstKey: "a-b-c",
          property: "--app-a-b-c",
          message: expect.stringMatching(/"a-b-c".*"a\.b-c".*--app-a-b-c/u),
        },
        {
          code: "duplicate-css-variable",
          key: "x.y-z",
          firstKey: "x-y.z",
          property: "--app-x-y-z",
          message: expect.stringMatching(/"x-y\.z".*"x\.y-z".*--app-x-y-z/u),
        },
      ],
    });
  });

  test("custom names collide like default names", () => {
    expect(
      exportCssVars(compile({ c: "3", a: "1", b: "2" }), { variableName: () => "--same" }),
    ).toMatchObject({
      ok: false,
      issues: [
        { code: "duplicate-css-variable", key: "b", firstKey: "a", property: "--same" },
        { code: "duplicate-css-variable", key: "c", firstKey: "a", property: "--same" },
      ],
    });
  });

  test("only selected keys can collide", () => {
    const graph = defineTokenGraph({
      tokens: {
        "a-b.c": "#ffffff",
        "a.b-c": { value: "#000000", visibility: "internal" },
      },
    });

    expect(orThrow(exportCssVars(orThrow(compileTokenGraph(graph)))).variableByToken).toEqual({
      "a-b.c": "--a-b-c",
    });
    expect(exportCssVars(orThrow(compileTokenGraph(graph, { selection: "all" })))).toMatchObject({
      ok: false,
      issues: [{ code: "duplicate-css-variable", key: "a.b-c", firstKey: "a-b.c" }],
    });
  });

  test("variableName receives the key, segments, default name, and a supplied prefix", () => {
    const inputs: unknown[] = [];
    orThrow(
      exportCssVars(compile({ "md.sys.color.primary": "1" }), {
        variableName(input) {
          inputs.push(input);
          return input.defaultName;
        },
      }),
    );
    orThrow(
      exportCssVars(compile({ "md.sys.color.primary": "1" }), {
        prefix: "app",
        variableName(input) {
          inputs.push(input);
          return input.defaultName;
        },
      }),
    );

    expect(inputs).toEqual([
      {
        tokenKey: "md.sys.color.primary",
        segments: ["md", "sys", "color", "primary"],
        defaultName: "--md-sys-color-primary",
      },
      {
        tokenKey: "md.sys.color.primary",
        segments: ["md", "sys", "color", "primary"],
        defaultName: "--app-md-sys-color-primary",
        prefix: "app",
      },
    ]);
  });

  test("callback failures and unsafe names are collected per key", () => {
    const result = exportCssVars(compile({ d: "4", c: "3", b: "2", a: "1", e: "5" }), {
      variableName({ tokenKey }) {
        switch (tokenKey) {
          case "a":
            throw new Error("consumer failure");
          case "b":
            return undefined as unknown as string;
          case "c":
            return "--C";
          case "d":
            return "--ok-d";
          default:
            return "color";
        }
      },
    });

    // A thrown or non-string result carries no `property`; an unsafe string carries it verbatim.
    const message = expect.any(String);
    expect(result).toEqual({
      ok: false,
      issues: [
        { code: "invalid-css-variable", message, key: "a" },
        { code: "invalid-css-variable", message, key: "b" },
        { code: "invalid-css-variable", message, key: "c", property: "--C" },
        { code: "invalid-css-variable", message, key: "e", property: "color" },
      ],
    });
  });

  test("name and value failures are collected together", () => {
    const result = exportCssVars(
      compile({ "a-b.c": "red; color: blue", "a.b-c": "#000000", ok: "#ffffff" }),
    );

    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: "duplicate-css-variable", key: "a.b-c" },
        { code: "invalid-css-value", key: "a-b.c", mode: "base", path: "/tokens/a-b.c/base" },
      ],
    });
  });

  test("a hostile callback name is rejected without backtracking", () => {
    const hostile = `--a${"--a".repeat(20_000)}!`;
    const started = performance.now();
    const result = exportCssVars(compile({ a: "1" }), { variableName: () => hostile });

    expect(result).toMatchObject({ ok: false, issues: [{ code: "invalid-css-variable" }] });
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

function compile(tokens: Readonly<Record<string, string>>) {
  return orThrow(compileTokenGraph(defineTokenGraph({ tokens })));
}
