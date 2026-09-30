// ADR 0013 Appendix A error matrix. Every case is a consumed `@ts-expect-error`.
import { defineTokenGraph, defineTokenLayer, tokenConcat, tokenRef } from "scheme-tokens";

const brand = defineTokenLayer({
  id: "brand",
  tokens: { "brand.600": "#6750a4", "brand.400": "#d0bcff" },
});

// E1: a reference typo to a graph key.
defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    // @ts-expect-error E1
    primary: tokenRef("brand.60"),
  },
});

// E2: a reference typo to a layer key.
defineTokenGraph({
  layers: [brand],
  tokens: {
    // @ts-expect-error E2
    primary: tokenRef("brand.60"),
  },
});

// E3: a mode map missing a graph mode.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    // @ts-expect-error E3
    background: { light: "#fff" },
  },
});

// E4: an undeclared mode in a direct mode map.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      light: "#fff",
      dark: "#000",
      // @ts-expect-error E4
      dim: "#333",
    },
  },
});

// E5: an invalid visibility.
defineTokenGraph({
  tokens: {
    // @ts-expect-error E5
    background: { value: "#fff", visibility: "private" },
  },
});

// E6: a reference typo inside an expanded mode map.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [brand],
  tokens: {
    primary: {
      value: {
        // @ts-expect-error E6
        light: tokenRef("brand.60"),
        dark: tokenRef("brand.400"),
      },
    },
  },
});

// E7: a reference typo inside concat.
defineTokenGraph({
  layers: [brand],
  tokens: {
    // @ts-expect-error E7
    ring: tokenConcat`0 0 0 3px ${tokenRef("brand.60")}`,
  },
});

// E8: a misspelled metadata property.
defineTokenGraph({
  tokens: {
    background: {
      value: "#fff",
      // @ts-expect-error E8
      descripton: "Canvas",
    },
  },
});

// E9: metadata mixed directly with mode keys.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    // @ts-expect-error E9
    background: { light: "#fff", dark: "#000", description: "Canvas" },
  },
});

// E10: an undeclared mode inside an expanded value mode map.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      value: {
        light: "#fff",
        dark: "#000",
        // @ts-expect-error E10
        dim: "#333",
      },
    },
  },
});

// V1: modes require an explicit default.
// @ts-expect-error V1
defineTokenGraph({ modes: ["light", "dark"], tokens: { a: "1" } });

defineTokenGraph({
  modes: ["light", "dark"],
  // @ts-expect-error V2: the default belongs to the declared mode set.
  defaultMode: "dim",
  tokens: { a: "1" },
});

defineTokenGraph({
  // @ts-expect-error V3: a default without modes.
  defaultMode: "base",
  tokens: { a: "1" },
});

// Graph-owned mode maps use the implicit base mode.
// @ts-expect-error a mode map needs the modes/defaultMode envelope.
defineTokenGraph({ tokens: { background: { light: "#fff", dark: "#000" } } });

// The mode grammar mirrors the runtime: one lower-kebab segment, not a reserved property.
defineTokenGraph({
  // @ts-expect-error valueByMode is not a lower-kebab identifier.
  modes: ["valueByMode"],
  defaultMode: "valueByMode",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error uppercase letters are invalid.
  modes: ["light", "Dark"],
  defaultMode: "light",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error a mode is a single segment.
  modes: ["light.dark"],
  defaultMode: "light.dark",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error hyphen-separated segments are non-empty.
  modes: ["light--high"],
  defaultMode: "light--high",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error a mode cannot end with a hyphen.
  modes: ["light-"],
  defaultMode: "light-",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error a mode starts with a letter.
  modes: ["2x"],
  defaultMode: "2x",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error a mode is not empty.
  modes: [""],
  defaultMode: "",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error token-definition properties are reserved.
  modes: ["light", "value"],
  defaultMode: "light",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error ref stays reserved.
  modes: ["ref"],
  defaultMode: "ref",
  tokens: { a: "1" },
});
defineTokenGraph({
  // @ts-expect-error modes are not empty.
  modes: [],
  defaultMode: "base",
  tokens: { a: "1" },
});

// Removed and persisted-only shapes stay rejected.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    // @ts-expect-error valueByMode is not a token property.
    background: { valueByMode: { light: "#fff", dark: "#000" } },
  },
});
defineTokenGraph({
  tokens: { "brand.600": "#6750a4" },
  // @ts-expect-error aliases were removed in favor of tokenRef().
  aliases: { primary: "brand.600" },
});
// @ts-expect-error persisted schema hints are not graph authoring options.
defineTokenGraph({ tokens: { a: "A" }, $schema: "hint" });
// @ts-expect-error persisted schema hints are not layer authoring options.
defineTokenLayer({ id: "example", tokens: { a: "A" }, $schema: "hint" });
// @ts-expect-error layers never declare modes.
defineTokenLayer({ id: "example", modes: ["light"], tokens: { a: "A" } });
// @ts-expect-error layers never declare a default mode.
defineTokenLayer({ id: "example", defaultMode: "light", tokens: { a: "A" } });
// @ts-expect-error template substitutions are references, never arbitrary strings.
void tokenConcat`prefix ${"a"}`;

// ADR 0015: `concat` alone never makes a value an expression.
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    // @ts-expect-error a one-mode map named concat is not a mode of this graph.
    a: { concat: "opaque" },
  },
});
defineTokenGraph({
  tokens: {
    a: "A",
    // @ts-expect-error an empty concat expression is invalid.
    b: { concat: [] },
  },
});
defineTokenGraph({
  tokens: {
    a: "A",
    // @ts-expect-error concat parts are flat.
    b: { concat: ["x", { concat: ["y", tokenRef("a")] }] },
  },
});
defineTokenGraph({
  tokens: {
    a: "A",
    // @ts-expect-error concat parts are strings or exact references.
    b: { concat: ["x", { ref: "a", fallback: "y" }] },
  },
});
defineTokenGraph({
  tokens: {
    a: "A",
    // @ts-expect-error a reference typo inside a raw concat record.
    b: { concat: ["x", tokenRef("b.typo")] },
  },
});
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    a: "A",
    b: {
      // @ts-expect-error mode-map values are expressions, not nested maps.
      light: { dark: "x" },
      dark: "y",
    },
  },
});
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    a: "A",
    b: {
      // @ts-expect-error mode-map references are exact.
      light: { ref: "a", fallback: "x" },
      dark: "y",
    },
  },
});
defineTokenGraph({
  tokens: {
    // @ts-expect-error a definition requires value.
    a: { description: "No value" },
  },
});
defineTokenGraph({
  tokens: {
    // @ts-expect-error token values are strings, references, concat records or mode maps.
    a: 5,
  },
});
defineTokenGraph({
  tokens: {
    // @ts-expect-error extensions carry JSON values.
    a: { value: "1", extensions: { "vendor.key": () => undefined } },
  },
});
declare const partialTokens: { readonly a?: string; readonly b: string };
// @ts-expect-error a token key that may be absent has no known definition.
defineTokenGraph({ tokens: partialTokens });
