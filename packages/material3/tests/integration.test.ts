import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  serializeTokenLayer,
  tokenRef,
} from "scheme-tokens";
import { describe, expect, test } from "vitest";
import { material3 } from "../src";

describe("core integration", () => {
  test("composes semantic references and preserves direct dependency metadata", () => {
    const generated = material3("#6750a4", { visibility: "internal" });
    const graph = defineTokenGraph({
      ...generated,
      tokens: {
        "action.primary.background": tokenRef("md.sys.color.primary"),
      },
    });
    const compiled = compileTokenGraph(graph, { selection: "all" });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.value.metadataByToken["md.sys.color.primary"].origin).toEqual({
      kind: "layer",
      id: "material3",
    });
    expect(
      compiled.value.metadataByToken["action.primary.background"].dependenciesByMode.light,
    ).toEqual(["md.sys.color.primary"]);
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
      ...generated,
      layers: [...generated.layers, overrides],
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
    expect(compiled.value.metadataByToken["md.sys.color.primary"].origin).toEqual({
      kind: "layer",
      id: "brand-overrides",
    });
    expect(compiled.value.tokens["brand.seed"].light).toBe("#6750a4");
  });

  test("uses the core variableName hook for Material-compatible CSS names", () => {
    const generated = material3("#6750a4");
    const compiled = compileTokenGraph(defineTokenGraph({ ...generated, tokens: {} }), {
      selection: "all",
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    const exported = exportCssVars(compiled.value, {
      variableName: ({ segments }) => `--${segments.join("-")}`,
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok) {
      throw new Error(JSON.stringify(exported.issues));
    }
    expect(exported.value.variableByToken["md.sys.color.primary"]).toBe("--md-sys-color-primary");
  });

  test("serializes a generated layer deterministically", () => {
    const layer = material3("#6750a4").layers[0];
    const first = serializeTokenLayer(layer);
    const second = serializeTokenLayer(material3("#6750A4").layers[0]);
    expect(first).toBe(second);
    expect(first).toContain('"id": "material3"');
  });

  test("rejects duplicate Material fragments through ordinary core validation", () => {
    const first = material3("#6750a4");
    const second = material3("#009489");
    expect(() =>
      defineTokenGraph({
        ...first,
        layers: [...first.layers, ...second.layers],
        tokens: {},
      }),
    ).toThrow(/duplicate id/u);
  });
});
