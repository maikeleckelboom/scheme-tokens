import { material3, type Material3ModeSettings } from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  tokenRef,
} from "scheme-tokens";

// One mode needs no envelope; a multi-mode graph owns its ordered envelope.
export const spacing = defineTokenGraph({ tokens: { gap: "8px" } });
export const surfaces = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { surface: { light: "#fff", dark: "#111" } },
});

// Public aliases resolve through internal sources before selection.
const sources = defineTokenLayer({
  id: "sources",
  defaultVisibility: "internal",
  tokens: { "brand.600": "#6750a4" },
});
const semantic = defineTokenLayer({
  id: "semantic",
  tokens: { "action.fill": tokenRef("brand.600") },
});
export const compositionRoot = defineTokenGraph({ layers: [sources, semantic] });
export const selected = orThrow(compileTokenGraph(compositionRoot, { selection: ["action.fill"] }));
function requestedKeys(): ("action.fill" | "brand.600")[] {
  return ["action.fill"];
}
export const dynamicSelection = compileTokenGraph(compositionRoot, { selection: requestedKeys() });

// Built-in names allow matching explicit colorMode, or its omission.
export const ordinaryMaterial = material3("#6750a4", {
  modeSettings: { light: { colorMode: "light" }, dark: {} },
});
const modeSettings = {
  "brand-day": { colorMode: "light", variant: "tonal-spot" },
  "brand-night": { colorMode: "dark", contrastLevel: 0.5 },
} satisfies Material3ModeSettings<"brand-day" | "brand-night">;
const applicationMaterial = material3("#6750a4", { modeSettings });
export const materialRoot = defineTokenGraph({
  modes: ["brand-day", "brand-night"],
  defaultMode: "brand-day",
  layers: [applicationMaterial],
});

const scheme = orThrow(compileTokenGraph(surfaces));
export const activated = orThrow(
  exportCssVars(scheme, {
    prefix: "app",
    references: "var",
    cascadeLayer: "tokens",
    activation: {
      media: { dark: "(prefers-color-scheme: dark)" },
      attribute: "data-mode",
      selectors: { dark: { selector: ".contrast", media: "(prefers-contrast: more)" } },
    },
  }),
);
export const shadowStyles = orThrow(
  exportCssVars(scheme, {
    activation: {
      root: ":host(.app)",
      attribute: { name: "data-mode", includeHost: true },
    },
  }),
);
// Install shadowStyles.css in the shadow root: the host and nested elements may
// each carry data-mode. See theme-coordinates/ for independent application axes.
