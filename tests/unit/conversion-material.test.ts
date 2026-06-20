import { describe, expect, test } from "vitest";
import { buildTokenSet, parseColor } from "../../src";
import { convertColor, isColorInGamut, mapColorToGamut } from "../../src/conversion";
import { material3Source, type Material3TokenKey } from "../../src/sources/material3";

function unwrap<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly issues: readonly unknown[] },
): Value {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe("conversion subpath", () => {
  test("converts, checks gamut, and explicitly maps", () => {
    const p3 = unwrap(parseColor({ colorSpace: "display-p3", r: 1, g: 0.22, b: 0.08, alpha: 1 }));

    const converted = unwrap(convertColor(p3, "srgb"));
    expect(converted.alpha).toBe(1);

    const mapped = unwrap(mapColorToGamut(converted, "srgb", { method: "preserve-lightness" }));
    expect(isColorInGamut(mapped, "srgb")).toBe(true);
  });
});

describe("Material 3 source", () => {
  test("emits fixed lower-kebab roles through buildTokenSet", () => {
    const requiredKey: Material3TokenKey = "m3.primary";
    expect(requiredKey).toBe("m3.primary");

    const result = unwrap(
      buildTokenSet({
        source: material3Source({ sourceColor: "#6750a4" }),
        selection: { keys: ["m3.primary", "m3.on-primary"] },
      }),
    );

    expect(Object.keys(result.tokenSet.tokens)).toEqual(["m3.on-primary", "m3.primary"]);
    expect(result.graph.defaultMode).toBe("light");
    expect(result.graph.tokens["m3.primary"]?.visibility).toBe("internal");
  });

  test("rejects old option name and non-opaque source colors", () => {
    expect(material3Source({ color: "#6750a4" } as never).build()).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "invalid-material3-options" }),
      ]),
    });
    expect(material3Source({ sourceColor: "#6750a480" }).build()).toMatchObject({
      ok: false,
      issues: [{ code: "unsupported-alpha" }],
    });
  });
});
