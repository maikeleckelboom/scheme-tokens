import { describe, expect, it } from "vitest";
import * as api from "../src/index";
import * as material3Api from "../src/sources/material3/index";

describe("public API", () => {
  it("exports only the generic root runtime surface", () => {
    expect(Object.keys(api).sort()).toEqual(
      [
        "compileGraph",
        "compileValidatedGraph",
        "createSchemeTokens",
        "createSourceGraph",
        "darkMode",
        "exportCssVariables",
        "hex",
        "isModeKey",
        "isTokenKey",
        "lightMode",
        "literalColor",
        "modeKey",
        "parseColorInput",
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

  it("exports Material 3 source runtime from the adapter subpath only", () => {
    expect(Object.prototype.hasOwnProperty.call(api, "material3Source")).toBe(false);
    expect(Object.keys(material3Api)).toEqual(["material3Source"]);
  });
});
