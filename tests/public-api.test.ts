import { describe, expect, it } from "vitest";
import * as api from "../src/index";

describe("public API", () => {
  it("exports only the implemented initial runtime surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "appSurfaceLayer",
        "compileGraph",
        "createSchemeGraph",
        "createSchemeTokens",
        "darkMode",
        "dynamicSchemeSource",
        "exportCssVariables",
        "hex",
        "lightMode",
        "literalColor",
        "modeKey",
        "parseHexColor",
        "parseModeKey",
        "parseTokenKey",
        "serializeTokenSet",
        "srgb255",
        "tokenKey",
        "validateGraph",
      ].sort(),
    );
  });

  it("does not expose legacy wrapper API names", () => {
    const forbidden = [
      "createTheme",
      "createColorScheme",
      "createCssVariables",
      "createCssVarMap",
      "createMaterialSchemeTokens",
      "createScheme",
      "MaterialTheme",
      "DynamicColorScheme",
      "PaletteStyle",
      "exportJsonTokens",
      "solidColorIntent",
    ];

    for (const name of forbidden) {
      expect(Object.prototype.hasOwnProperty.call(api, name)).toBe(false);
    }
  });
});
