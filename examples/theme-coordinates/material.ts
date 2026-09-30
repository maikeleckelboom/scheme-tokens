import { material3, type Material3Modes } from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  tokenRef,
} from "scheme-tokens";

const modes = [
  "mono-light",
  "mono-dark",
  "vivid-light",
  "vivid-dark",
  "material3-light",
  "material3-dark",
] as const;
type Mode = (typeof modes)[number];
const settings = {
  "mono-light": { colorMode: "light", variant: "monochrome" },
  "mono-dark": { colorMode: "dark", variant: "monochrome" },
  "vivid-light": { colorMode: "light", variant: "vibrant" },
  "vivid-dark": { colorMode: "dark", variant: "vibrant" },
  "material3-light": { colorMode: "light" },
  "material3-dark": { colorMode: "dark" },
} as const satisfies Material3Modes<Mode>;
const material = material3("#6750a4", {
  modes: settings,
  visibility: "internal",
  specVersion: "2021",
});
const graph = defineTokenGraph({
  modes,
  defaultMode: "mono-light",
  layers: [material],
  tokens: { "action.primary": tokenRef("md.sys.color.primary") },
});
const selected = orThrow(compileTokenGraph(graph, { selection: { keys: ["action.primary"] } }));
const css = orThrow(
  exportCssVars(selected, {
    prefix: "color",
    attribute: "data-coordinate",
    system: { "mono-dark": "(prefers-color-scheme: dark)" },
  }),
);
const precise: Record<Mode, string> = selected.tokens["action.primary"];
const name: string = css.variableByToken["action.primary"];
void precise;
void name;
// @ts-expect-error exact selection excludes Material's internal roles
void selected.tokens["md.sys.color.primary"];
// @ts-expect-error the graph owns the six-mode union
void selected.tokens["action.primary"].dark;
if (JSON.stringify(selected.modes) !== JSON.stringify(modes) || css.blocks.length !== 8) {
  throw new Error("Material coordinate order or activation tiers changed");
}
for (const block of css.blocks) {
  const declaration = block.declarations[0];
  if (block.declarations.length !== 1 || declaration?.value !== precise[block.mode]) {
    throw new Error("Material coordinate structured declarations differ from selected values");
  }
  if (!css.css.includes(`${declaration.property}: ${declaration.value};`)) {
    throw new Error("Material coordinate CSS differs from its structured declarations");
  }
}
