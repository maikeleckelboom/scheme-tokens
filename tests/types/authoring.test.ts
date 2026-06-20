import { defineTokenFragment, defineTokenGraph, type TokenGraphInput } from "../../src";

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "app.background": {
      valueByMode: {
        light: "#ffffff",
        dark: "#111111",
      },
    },
  },
});

const typedGraph = graph satisfies TokenGraphInput<"light" | "dark">;
typedGraph.defaultMode.toUpperCase();

defineTokenFragment({
  formatVersion: 1,
  id: "brand",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      value: "#6750a4",
    },
  },
});

defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  // @ts-expect-error defaultMode must be one of the declared modes.
  defaultMode: "sepia",
  defaultVisibility: "public",
  tokens: {},
});

defineTokenGraph({
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    "app.background": {
      // @ts-expect-error dark mode is required.
      valueByMode: {
        light: "#ffffff",
      },
    },
  },
});
