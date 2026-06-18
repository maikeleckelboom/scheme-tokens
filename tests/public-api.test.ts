import { describe, expect, it } from "vitest";
import * as api from "../src/index";

describe("public API", () => {
  it("exports only the implemented initial runtime surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "compileGraph",
        "createSchemeGraph",
        "darkMode",
        "exportCssVariables",
        "hex",
        "lightMode",
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
      "createMaterialSchemeTokens",
      "MaterialTheme",
      "DynamicColorScheme",
    ];

    for (const name of forbidden) {
      expect(Object.prototype.hasOwnProperty.call(api, name)).toBe(false);
    }
  });
});
