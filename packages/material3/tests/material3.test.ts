import { describe, expect, test, vi } from "vitest";
import * as core from "scheme-tokens";
import type { TokenLayer } from "scheme-tokens";
import * as engine from "../src/engine";
import { material3RoleDefinitions } from "../src/role-catalog";
import { material3, type Material3TokenKey, type Material3Variant } from "../src";

const allVariants = [
  "monochrome",
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
] as const satisfies readonly Material3Variant[];
const supported2025Variants = ["neutral", "tonal-spot", "vibrant", "expressive"] as const;
const rejected2025Variants = [
  "monochrome",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
] as const;

describe("material3", () => {
  test("generates one fixed public default layer", () => {
    const layer = material3("#6750a4");

    expect(layer).not.toHaveProperty("modes");
    expect(layer).not.toHaveProperty("defaultMode");
    expect(layer).not.toHaveProperty("layers");
    expect(layer.id).toBe("material3");
    expect(layer.defaultVisibility).toBe("public");
    expect(Object.keys(layer.tokens)).toHaveLength(48);
    expect(layer.tokens["md.sys.color.primary"]?.value).toEqual({
      light: "#65558f",
      dark: "#cfbdfe",
    });
  });

  test("explicit modes replaces the default completely", () => {
    const layer = material3("#6750a4", { modes: { standard: { colorMode: "light" } } });
    expect(layer.tokens["md.sys.color.primary"]?.value).toEqual({ standard: "#65558f" });
  });

  test("rejects an empty exact modes map", () => {
    expect(() => material3("#6750a4", { modes: {} } as never)).toThrow(TypeError);
  });

  test("accepts exact six-digit sources and canonicalizes uppercase", () => {
    expect(material3("#6750A4")).toEqual(material3("#6750a4"));
  });

  test.each([
    "6750a4",
    "#abc",
    "#6750a4ff",
    " #6750a4",
    "#6750a4 ",
    "rgb(103 80 164)",
    "oklch(50% 0.2 300)",
    "#6750a480",
  ])("rejects unsupported source form %s", (source) => {
    expect(() => material3(source)).toThrow(RangeError);
  });

  test("rejects a non-string source", () => {
    expect(() => material3(0x6750a4 as never)).toThrow(TypeError);
  });

  test.each([-1, -0.375, 0, 0.125, 0.5, 1])("accepts contrast level %s", (contrastLevel) => {
    expect(() => material3("#6750a4", { contrastLevel })).not.toThrow();
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1.001, 1.001])(
    "rejects contrast level %s",
    (contrastLevel) => {
      expect(() => material3("#6750a4", { contrastLevel })).toThrow(RangeError);
    },
  );

  test("rejects a non-number contrast level", () => {
    expect(() => material3("#6750a4", { contrastLevel: "0" } as never)).toThrow(TypeError);
  });

  test.each(allVariants)("supports requested 2021 variant %s", (variant) => {
    expect(() => material3("#6750a4", { specVersion: "2021", variant })).not.toThrow();
  });

  test.each(supported2025Variants)("supports requested 2025 variant %s", (variant) => {
    expect(() => material3("#6750a4", { specVersion: "2025", variant })).not.toThrow();
  });

  test.each(rejected2025Variants)("rejects requested 2025 fallback variant %s", (variant) => {
    expect(() => material3("#6750a4", { specVersion: "2025", variant })).toThrow(RangeError);
  });

  test("generates complete exact six-mode maps", () => {
    const layer = material3("#6750a4", {
      visibility: "internal",
      modes: {
        "mono-light": { colorMode: "light", variant: "monochrome" },
        "mono-dark": { colorMode: "dark", variant: "monochrome" },
        "vivid-light": { colorMode: "light" },
        "vivid-dark": { colorMode: "dark" },
        "material3-light": { colorMode: "light" },
        "material3-dark": { colorMode: "dark" },
      },
    });
    expect(Object.keys(layer.tokens)).toEqual(
      material3RoleDefinitions.map(({ tokenKey }) => tokenKey).sort(),
    );
    for (const definition of Object.values(layer.tokens)) {
      expect(definition).not.toHaveProperty("visibility");
      expect(Object.keys(definition.value)).toEqual([
        "material3-dark",
        "material3-light",
        "mono-dark",
        "mono-light",
        "vivid-dark",
        "vivid-light",
      ]);
      for (const value of Object.values(definition.value)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/u);
      }
    }
    expect(modeValue(layer, "md.sys.color.primary", "vivid-light")).toBe(
      modeValue(layer, "md.sys.color.primary", "material3-light"),
    );
    expect(modeValue(layer, "md.sys.color.primary", "mono-light")).not.toBe(
      modeValue(layer, "md.sys.color.primary", "vivid-light"),
    );
    expect(layer.defaultVisibility).toBe("internal");
  });

  test("allows one built-in mode and valid custom concat", () => {
    const light = material3("#6750a4", { modes: { light: {} } });
    const concat = material3("#6750a4", { modes: { concat: { colorMode: "light" } } });
    for (const definition of Object.values(light.tokens)) {
      expect(Object.keys(definition.value)).toEqual(["light"]);
    }
    expect(modeValue(concat, "md.sys.color.primary", "concat")).toBe(
      modeValue(light, "md.sys.color.primary", "light"),
    );
    expect(() => material3("#6750a4", { modes: { concat: {} } } as never)).toThrow(TypeError);
  });

  test("resolves source, variant and contrast independently per field", () => {
    const layer = material3("#6750a4", {
      variant: "neutral",
      contrastLevel: -0.25,
      modes: {
        inherited: { colorMode: "light" },
        source: { colorMode: "dark", sourceColor: "#009489" },
        variant: { colorMode: "light", variant: "expressive" },
        contrast: { colorMode: "dark", contrastLevel: 1 },
        combined: {
          colorMode: "dark",
          sourceColor: "#009489",
          variant: "expressive",
          contrastLevel: 1,
        },
        light: { sourceColor: "#009489" },
      },
    });
    const expected = {
      inherited: material3("#6750a4", { variant: "neutral", contrastLevel: -0.25 }),
      source: material3("#009489", { variant: "neutral", contrastLevel: -0.25 }),
      variant: material3("#6750a4", { variant: "expressive", contrastLevel: -0.25 }),
      contrast: material3("#6750a4", { variant: "neutral", contrastLevel: 1 }),
      combined: material3("#009489", { variant: "expressive", contrastLevel: 1 }),
      light: material3("#009489", { variant: "neutral", contrastLevel: -0.25 }),
    };
    for (const { tokenKey } of material3RoleDefinitions) {
      for (const mode of [
        "inherited",
        "source",
        "variant",
        "contrast",
        "combined",
        "light",
      ] as const) {
        const colorMode =
          mode === "inherited" || mode === "variant" || mode === "light" ? "light" : "dark";
        expect(modeValue(layer, tokenKey, mode)).toBe(
          modeValue(expected[mode], tokenKey, colorMode),
        );
      }
    }
  });

  test("validates effective coordinates, allowing an unsupported global variant overridden everywhere", () => {
    expect(() =>
      material3("#6750a4", {
        specVersion: "2025",
        variant: "monochrome",
        modes: { light: { variant: "neutral" }, dark: { variant: "expressive" } },
      }),
    ).not.toThrow();
  });

  test("rejects an unsupported later mode before any generation", () => {
    const generation = vi.spyOn(engine, "generateMaterial3Mode");
    try {
      expect(() =>
        material3("#6750a4", {
          specVersion: "2025",
          modes: {
            "a-supported": { colorMode: "light", variant: "neutral" },
            "z-unsupported": { colorMode: "dark", variant: "fidelity" },
          },
        }),
      ).toThrow(/z-unsupported/u);
      expect(generation).not.toHaveBeenCalled();
    } finally {
      generation.mockRestore();
    }
  });

  test.each([
    "ref",
    "value",
    "visibility",
    "description",
    "deprecated",
    "extensions",
    "valueByMode",
    "Light",
    "two.parts",
    "",
    "2mode",
  ])("propagates core mode-name validation for %j", (mode) => {
    const modes = [mode] as [string];
    const coreError = captureError(() =>
      core.defineTokenGraph({ modes, defaultMode: mode, tokens: {} }),
    );
    const generation = vi.spyOn(engine, "generateMaterial3Mode");
    try {
      const adapterError = captureError(() =>
        material3("#6750a4", { modes: { [mode]: { colorMode: "light" } } }),
      );
      expect(adapterError.constructor).toBe(Error);
      expect(adapterError.message).toBe(coreError.message);
      expect(adapterError.cause).toEqual(coreError.cause);
      expect(adapterError.cause).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "invalid-mode-key" })]),
      );
      expect(generation).not.toHaveBeenCalled();
    } finally {
      generation.mockRestore();
    }
  });

  test("does not replace the original core error instance", () => {
    const original = captureError(() =>
      core.defineTokenGraph({ modes: ["value"] as [string], defaultMode: "value", tokens: {} }),
    );
    const preflight = vi.spyOn(core, "defineTokenGraph").mockImplementationOnce(() => {
      throw original;
    });
    try {
      expect(captureError(() => material3("#6750a4"))).toBe(original);
    } finally {
      preflight.mockRestore();
    }
  });

  test("copies trusted plain data and normalizes per-mode sources", () => {
    const options = {
      visibility: "internal",
      modes: { light: { sourceColor: "#009489" } },
    } as const;
    const before = structuredClone(options);
    const layer = material3("#6750a4", options);
    expect(options).toEqual(before);
    expect(material3("#6750a4", { modes: { light: { sourceColor: "#009489" } } })).toEqual(
      material3("#6750a4", { modes: { light: { sourceColor: "#009489".toUpperCase() } } }),
    );
    Object.assign(options.modes.light, { sourceColor: "#ff0000" });
    expect(layer).toEqual(material3("#6750a4", before));
    const nullPrototype: object = Object.assign(Object.create(null), before);
    expect(material3("#6750a4", nullPrototype)).toEqual(layer);
  });

  test("rejects accessor data without invoking it", () => {
    const getter = vi.fn<() => string>(() => "dark");
    const modes = {
      custom: Object.defineProperty({}, "colorMode", { enumerable: true, get: getter }),
    };
    expect(() => material3("#6750a4", { modes } as never)).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });

  test.each([
    [null, TypeError],
    [[], TypeError],
    [new Date(), TypeError],
    [{ unknown: true }, RangeError],
    [{ sourceColor: "#ff0000" }, RangeError],
    [{ appearance: "light" }, RangeError],
    [{ exactModes: { light: {} } }, RangeError],
    [{ defaultMode: "light" }, RangeError],
    [{ modes: undefined }, TypeError],
    [{ modes: {} }, TypeError],
    [{ modes: [] }, TypeError],
    [{ modes: { "light-high": "light" } }, TypeError],
    [{ modes: { "light-high": {} } }, TypeError],
    [{ modes: { "dark-brand": { colorMode: "dim" } } }, RangeError],
    [{ modes: { light: { colorMode: "light" } } }, RangeError],
    [{ modes: { dark: { colorMode: "dark" } } }, RangeError],
    [{ modes: { dark: { colorMode: undefined } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", appearance: "light" } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", specVersion: "2025" } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", visibility: "internal" } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", platform: "phone" } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", sourceColor: "#abc" } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", contrastLevel: 2 } } }, RangeError],
    [{ modes: { custom: { colorMode: "light", variant: "dynamic" } } }, RangeError],
    [{ visibility: "private" }, RangeError],
    [{ variant: "dynamic" }, RangeError],
    [{ specVersion: "2026" }, RangeError],
  ])("rejects invalid runtime options %#", (options, ErrorType) => {
    const generation = vi.spyOn(engine, "generateMaterial3Mode");
    try {
      expect(() => material3("#6750a4", options as never)).toThrow(ErrorType);
      expect(generation).not.toHaveBeenCalled();
    } finally {
      generation.mockRestore();
    }
  });
});

function modeValue(
  layer: TokenLayer<Material3TokenKey>,
  key: Material3TokenKey,
  mode: string,
): string {
  const value = layer.tokens[key]?.value;
  if (value === undefined || typeof value === "string" || "ref" in value) {
    throw new Error(`Expected generated mode map for ${key}.`);
  }
  const modeValue: unknown = Object.getOwnPropertyDescriptor(value, mode)?.value;
  if (typeof modeValue !== "string") {
    throw new Error(`Expected generated value for ${key}/${mode}.`);
  }
  return modeValue;
}

function captureError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected an error.");
}
