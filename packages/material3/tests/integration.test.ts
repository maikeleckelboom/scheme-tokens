import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  parseTokenGraph,
  serializeTokenLayer,
  tokenRef,
} from "scheme-tokens";
import { describe, expect, test } from "vitest";
import { material3, type Material3ModeSettings } from "../src";

describe("core integration", () => {
  test("composes semantic references and preserves direct dependency metadata", () => {
    const generated = material3("#6750a4", { visibility: "internal" });
    const graph = defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "light",
      layers: [generated],
      tokens: {
        "action.primary.background": tokenRef("md.sys.color.primary"),
      },
    });
    const compiled = compileTokenGraph(graph, { selection: "all" });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(
      compiled.value.metadataByToken["md.sys.color.primary"].declarations.at(-1)?.origin,
    ).toEqual({
      kind: "layer",
      id: "material3",
    });
    expect(
      compiled.value.metadataByToken["action.primary.background"].expressionByMode?.light,
    ).toEqual({ ref: "md.sys.color.primary" });
    expect(compiled.value.tokens["action.primary.background"].light).toBe(
      compiled.value.tokens["md.sys.color.primary"].light,
    );
  });

  test("uses ordinary later-layer overrides and records winning provenance", () => {
    const generated = material3("#6750a4", { visibility: "internal" });
    const overrides = defineTokenLayer({
      id: "brand-overrides",
      tokens: { "md.sys.color.primary": "#ff0055" },
    });
    const graph = defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "light",
      layers: [generated, overrides],
      tokens: {
        "action.primary.background": tokenRef("md.sys.color.primary"),
        "brand.seed": "#6750a4",
      },
    });
    const compiled = compileTokenGraph(graph, { selection: "all" });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.value.tokens["md.sys.color.primary"].light).toBe("#ff0055");
    expect(compiled.value.tokens["action.primary.background"].dark).toBe("#ff0055");
    expect(
      compiled.value.metadataByToken["md.sys.color.primary"].declarations.at(-1)?.origin,
    ).toEqual({
      kind: "layer",
      id: "brand-overrides",
    });
    expect(compiled.value.tokens["brand.seed"].light).toBe("#6750a4");
  });

  test("core default CSS names match Material Web names", () => {
    const generated = material3("#6750a4");
    const compiled = compileTokenGraph(
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        layers: [generated],
        tokens: {},
      }),
      {
        selection: "all",
      },
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    const exported = exportCssVars(compiled.value, {
      activation: { attribute: "data-theme", selectors: { dark: ".dark" } },
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      throw new Error(JSON.stringify(exported.issues));
    }
    expect(exported.value.variableByToken["md.sys.color.primary"]).toBe("--md-sys-color-primary");
    expect(exported.value.variableByToken["md.sys.color.on-primary-container"]).toBe(
      "--md-sys-color-on-primary-container",
    );
    expect(exported.value.blocks.map((block) => `${block.tier}:${block.mode}`)).toEqual([
      "default:light",
      "attribute:light",
      "attribute:dark",
      "selector:dark",
    ]);
    for (const block of exported.value.blocks) {
      expect(block.declarations).toHaveLength(48);
    }
  });

  test("serializes a generated layer deterministically", () => {
    const layer = material3("#6750a4");
    const first = serializeTokenLayer(layer);
    const second = serializeTokenLayer(material3("#6750A4"));
    expect(first).toBe(second);
    expect(first).toContain('"id": "material3"');
  });

  test("rejects duplicate Material layers through ordinary core validation", () => {
    const first = material3("#6750a4");
    const second = material3("#009489");
    expect(() =>
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        layers: [first, second],
        tokens: {},
      }),
    ).toThrow(/duplicate-layer-id/u);
  });
  test("graph-owned overrides preserve visibility and ordered declarations", () => {
    const material = material3("#6750a4", { visibility: "internal" });
    const brand = defineTokenLayer({
      id: "brand",
      tokens: { "md.sys.color.primary": "#ff0055", "brand.radius": "4px" },
    });
    const graph = defineTokenGraph({
      modes: ["dark", "light"],
      defaultMode: "dark",
      layers: [material, brand],
      tokens: {
        "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" },
        "action.primary": tokenRef("md.sys.color.primary"),
        "md.sys.color.secondary": { value: "#000000", visibility: "public" },
      },
    });
    const all = orThrow(compileTokenGraph(graph, { selection: "all" }));
    expect(all.modes).toEqual(["dark", "light"]);
    expect(all.defaultMode).toBe("dark");
    expect(all.tokens["action.primary"]).toEqual({ dark: "#f2b8b5", light: "#b3261e" });
    expect(all.metadataByToken["md.sys.color.primary"]).toMatchObject({
      visibility: "internal",
      declarations: [
        { origin: { kind: "layer", id: "material3" } },
        { origin: { kind: "layer", id: "brand" } },
        { origin: { kind: "graph" } },
      ],
    });
    expect(
      all.metadataByToken["md.sys.color.primary"].declarations.every(
        (declaration) => declaration.declaredVisibility === undefined,
      ),
    ).toBe(true);
    expect(Object.keys(orThrow(compileTokenGraph(graph)).tokens)).toEqual([
      "action.primary",
      "brand.radius",
      "md.sys.color.secondary",
    ]);
    const reversed = orThrow(
      compileTokenGraph(
        defineTokenGraph({
          modes: ["light", "dark"],
          defaultMode: "light",
          layers: [brand, material],
          tokens: {},
        }),
        { selection: "all" },
      ),
    );
    expect(reversed.tokens["md.sys.color.primary"].light).toBe("#65558f");
    expect(reversed.metadataByToken["md.sys.color.primary"].visibility).toBe("public");
  });

  test("dynamic visibility can include roles in public selection", () => {
    for (const visibility of ["public", "internal"] as const) {
      const layer = material3("#6750a4", { visibility });
      const graph = defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        layers: [layer],
        tokens: { alias: tokenRef("md.sys.color.primary") },
      });
      const compiled = orThrow(compileTokenGraph(graph));
      expect(Object.keys(compiled.tokens)).toHaveLength(visibility === "public" ? 49 : 1);
      expect(compiled.tokens.alias?.light).toBe("#65558f");
    }
  });

  test("core rejects mismatched dynamic mode sets with one layer issue", () => {
    const layer = material3("#6750a4", { modeSettings: { standard: { colorMode: "light" } } });
    const modes: readonly [string, ...string[]] = ["light", "dark"];
    const input = { modes, defaultMode: "light", layers: [layer], tokens: {} };
    const expected = {
      code: "layer-mode-mismatch",
      path: "/layers/0",
      layerId: "material3",
      modes: ["light", "dark"],
      layerModes: ["standard"],
    };
    expect(() => defineTokenGraph(input)).toThrowError(
      expect.objectContaining({ cause: [expect.objectContaining(expected)] }),
    );
    expect(
      parseTokenGraph({
        kind: "scheme-tokens/token-graph",
        formatVersion: 2,
        defaultVisibility: "public",
        ...input,
      }),
    ).toEqual({ ok: false, issues: [expect.objectContaining(expected)] });
  });

  test("a dynamic settings map retains runtime validation in a literal graph", () => {
    const modes: Material3ModeSettings<string> = { standard: { colorMode: "light" } };
    const layer = material3("#6750a4", { modeSettings: modes });
    expect(() =>
      defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        layers: [layer],
        tokens: {},
      }),
    ).toThrowError(
      expect.objectContaining({
        cause: [
          expect.objectContaining({
            code: "layer-mode-mismatch",
            path: "/layers/0",
            layerId: "material3",
            modes: ["light", "dark"],
            layerModes: ["standard"],
          }),
        ],
      }),
    );
  });
});
