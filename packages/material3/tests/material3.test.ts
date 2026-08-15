import { describe, expect, test } from "vitest";
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
  test("generates the fixed public default fragment", () => {
    const fragment = material3("#6750a4");
    const layer = fragment.layers[0];

    expect(fragment.modes).toEqual(["light", "dark"]);
    expect(fragment.defaultMode).toBe("light");
    expect(layer.id).toBe("material3");
    expect(layer.defaultVisibility).toBe("public");
    expect(Object.keys(layer.tokens)).toHaveLength(48);
    expect(modeValue(fragment, "md.sys.color.primary", "light")).toBe("#65558f");
    expect(modeValue(fragment, "md.sys.color.primary", "dark")).toBe("#cfbdfe");
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

  test("accepts dark as the built-in default without a modes object", () => {
    const fragment = material3("#6750a4", { defaultMode: "dark" });
    expect(fragment.defaultMode).toBe("dark");
    expect(fragment.modes).toEqual(["dark", "light"]);
  });

  test("patches built-ins and adds exact custom additive modes", () => {
    const fragment = material3("#6750a4", {
      modes: {
        dark: { variant: "expressive" },
        "light-high": { appearance: "light", contrastLevel: 1 },
        "brand-dark": { appearance: "dark", sourceColor: "#009489" },
      },
      defaultMode: "light-high",
    });

    expect(fragment.modes).toEqual(["light-high", "brand-dark", "dark", "light"]);
    expect(modeValue(fragment, "md.sys.color.primary", "dark")).not.toBe(
      modeValue(material3("#6750a4"), "md.sys.color.primary", "dark"),
    );
    expect(modeValue(fragment, "md.sys.color.primary", "brand-dark")).not.toBe(
      modeValue(fragment, "md.sys.color.primary", "light"),
    );
  });

  test("replaces the complete mode set through exactModes", () => {
    const fragment = material3("#6750a4", {
      exactModes: {
        standard: { appearance: "light" },
        inverse: { appearance: "dark", contrastLevel: 0.5 },
      },
      defaultMode: "standard",
    });

    expect(fragment.modes).toEqual(["standard", "inverse"]);
    expect(fragment.layers[0].tokens["md.sys.color.primary"]?.value).not.toHaveProperty("light");
    expect(fragment.layers[0].tokens["md.sys.color.primary"]?.value).not.toHaveProperty("dark");
  });

  test("allows exact built-in-only and exact one-mode envelopes", () => {
    expect(
      material3("#6750a4", {
        exactModes: { light: {}, dark: {} },
        defaultMode: "dark",
      }).modes,
    ).toEqual(["dark", "light"]);
    expect(
      material3("#6750a4", {
        exactModes: { standard: { appearance: "light" } },
        defaultMode: "standard",
      }).modes,
    ).toEqual(["standard"]);
  });

  test("merges per-mode source, variant, and contrast over global defaults", () => {
    const global = material3("#6750a4", {
      variant: "neutral",
      contrastLevel: -0.25,
    });
    const overridden = material3("#6750a4", {
      variant: "neutral",
      contrastLevel: -0.25,
      modes: {
        dark: {
          sourceColor: "#009489",
          variant: "expressive",
          contrastLevel: 1,
        },
      },
    });

    expect(modeValue(overridden, "md.sys.color.primary", "light")).toBe(
      modeValue(global, "md.sys.color.primary", "light"),
    );
    expect(modeValue(overridden, "md.sys.color.primary", "dark")).not.toBe(
      modeValue(global, "md.sys.color.primary", "dark"),
    );
  });

  test("maps visibility only to the generated layer", () => {
    expect(material3("#6750a4").layers[0].defaultVisibility).toBe("public");
    expect(material3("#6750a4", { visibility: "internal" }).layers[0].defaultVisibility).toBe(
      "internal",
    );
  });

  test.each([
    [null, TypeError],
    [[], TypeError],
    [{ unknown: true }, RangeError],
    [{ modes: {}, exactModes: {} }, RangeError],
    [{ exactModes: {}, defaultMode: "light" }, TypeError],
    [{ exactModes: { standard: { appearance: "light" } } }, TypeError],
    [{ defaultMode: "midnight" }, RangeError],
    [{ modes: { value: { appearance: "light" } } }, RangeError],
    [{ modes: { "light-high": {} } }, TypeError],
    [{ modes: { "dark-brand": { appearance: "dim" } } }, RangeError],
    [{ modes: { light: { appearance: "light" } } }, RangeError],
    [{ modes: { dark: { appearance: "dark" } } }, RangeError],
    [{ modes: { "light-high": { appearance: "light", specVersion: "2025" } } }, RangeError],
    [{ modes: { "light-high": { appearance: "light", visibility: "internal" } } }, RangeError],
    [{ modes: { "light-high": { appearance: "light", platform: "phone" } } }, RangeError],
    [{ visibility: "private" }, RangeError],
    [{ variant: "dynamic" }, RangeError],
    [{ specVersion: "2026" }, RangeError],
  ])("rejects invalid runtime options %#", (options, ErrorType) => {
    expect(() => material3("#6750a4", options as never)).toThrow(ErrorType);
  });
});

function modeValue(
  fragment: ReturnType<typeof material3>,
  key: Material3TokenKey,
  mode: string,
): string {
  const value = fragment.layers[0].tokens[key]?.value;
  if (value === undefined || typeof value === "string" || "ref" in value) {
    throw new Error(`Expected generated mode map for ${key}.`);
  }
  const modeValue = value[mode];
  if (typeof modeValue !== "string") {
    throw new Error(`Expected generated value for ${key}/${mode}.`);
  }
  return modeValue;
}
