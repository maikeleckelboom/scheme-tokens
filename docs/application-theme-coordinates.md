# Application Theme Coordinates

Applications can have several independent theme axes even though `scheme-tokens` models one explicit mode envelope. Keep the application concepts independent in runtime state, persistence, controls, and URLs. Combine them only at the compiler boundary.

For example, an application can own `PaletteId` and `ResolvedScheme` while its build adapter privately maps each coordinate to a complete compiler mode. The flattened names are implementation details, not a theme-coordinate abstraction that the library or application state needs to expose.

Exact token selection makes the downstream semantic contract explicit. Exact selector maps can then attach each private compiler mode to the application's compound selectors. When an application needs another selector or an at-rule, reuse the exporter's structured declarations and compose that policy outside the package.

```ts twoslash
import {
  compileTokenGraph,
  defineTokens,
  exportCssVars,
  tokenRef,
  type CssVarDeclaration,
} from "scheme-tokens";

type PaletteId = "mono" | "vivid";
type ResolvedScheme = "light" | "dark";
type CoordinateKey = "mono:light" | "mono:dark" | "vivid:light" | "vivid:dark";

const compilerModes = ["mono-light", "mono-dark", "vivid-light", "vivid-dark"] as const;
type CompilerMode = (typeof compilerModes)[number];

const compilerModeByCoordinate = {
  "mono:light": "mono-light",
  "mono:dark": "mono-dark",
  "vivid:light": "vivid-light",
  "vivid:dark": "vivid-dark",
} as const satisfies Readonly<Record<CoordinateKey, CompilerMode>>;

export function compilerModeFor(palette: PaletteId, scheme: ResolvedScheme): CompilerMode {
  const coordinate: CoordinateKey =
    palette === "mono"
      ? scheme === "light"
        ? "mono:light"
        : "mono:dark"
      : scheme === "light"
        ? "vivid:light"
        : "vivid:dark";
  return compilerModeByCoordinate[coordinate];
}

const graph = defineTokens(
  {
    "source.paper": {
      value: {
        "mono-light": "#ffffff",
        "mono-dark": "#111111",
        "vivid-light": "#fffaf5",
        "vivid-dark": "#111321",
      },
      visibility: "internal",
    },
    "source.ink": {
      value: {
        "mono-light": "#111111",
        "mono-dark": "#f5f5f5",
        "vivid-light": "#201a2b",
        "vivid-dark": "#f4efff",
      },
      visibility: "internal",
    },
    "source.primary": {
      value: {
        "mono-light": "#1a1a1a",
        "mono-dark": "#f0f0f0",
        "vivid-light": "#5b45d6",
        "vivid-dark": "#b8a9ff",
      },
      visibility: "internal",
    },
    "source.signal": {
      value: "currentColor",
      visibility: "internal",
    },
    "surface.canvas": tokenRef("source.paper"),
    "surface.default": tokenRef("source.paper"),
    "content.primary": tokenRef("source.ink"),
    "content.muted": {
      "mono-light": "#5f6368",
      "mono-dark": "#a0a4aa",
      "vivid-light": "#665f73",
      "vivid-dark": "#c8c1d4",
    },
    "action.primary.background": tokenRef("source.primary"),
    "action.primary.foreground": tokenRef("source.paper"),
    "focus.ring": tokenRef("source.signal"),
    "selection.background": tokenRef("source.primary"),
    "selection.foreground": tokenRef("source.paper"),
    "renderer.field": tokenRef("source.signal"),
    "renderer.signal": tokenRef("source.signal"),
  },
  {
    modes: compilerModes,
    defaultMode: "mono-light",
  },
);

const publicRoleKeys = [
  "surface.canvas",
  "surface.default",
  "content.primary",
  "content.muted",
  "action.primary.background",
  "action.primary.foreground",
  "focus.ring",
  "selection.background",
  "selection.foreground",
  "renderer.field",
  "renderer.signal",
] as const;

const compiled = compileTokenGraph(graph, {
  selection: {
    keys: publicRoleKeys,
  },
});

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

compiled.value.tokens["surface.canvas"]["mono-light"];
compiled.value.tokens["renderer.signal"]["vivid-dark"];

const exported = exportCssVars(compiled.value, {
  prefix: "app",
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      "mono-light": ":root",
      "mono-dark": ':root[data-scheme="dark"]',
      "vivid-light": ':root[data-palette="vivid"][data-scheme="light"]',
      "vivid-dark": ':root[data-palette="vivid"][data-scheme="dark"]',
    },
  },
  format: "pretty",
});

if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

const cssExport = exported.value;
const monoLight = requiredBlock("mono-light");
const monoDark = requiredBlock("mono-dark");

// Application policy reuses the compiler-owned declaration records.
const explicitLightCss = formatSelectorBlock(':root[data-scheme="light"]', monoLight.declarations);
const noScriptDarkCss = formatDarkFallback(monoDark.declarations);

export const applicationThemeCss = [cssExport.css, explicitLightCss, noScriptDarkCss].join("\n\n");

function requiredBlock(mode: CompilerMode) {
  const block = cssExport.blocks.find((candidate) => candidate.mode === mode);
  if (block === undefined) {
    throw new Error("Missing CSS block for mode: " + mode);
  }
  return block;
}

function formatSelectorBlock(selector: string, declarations: readonly CssVarDeclaration[]): string {
  return [
    selector + " {",
    ...declarations.map(
      (declaration) => "  " + declaration.property + ": " + declaration.value + ";",
    ),
    "}",
  ].join("\n");
}

function formatDarkFallback(declarations: readonly CssVarDeclaration[]): string {
  return [
    "@media (prefers-color-scheme: dark) {",
    "  :root:not([data-scheme]) {",
    ...declarations.map(
      (declaration) => "    " + declaration.property + ": " + declaration.value + ";",
    ),
    "  }",
    "}",
  ].join("\n");
}
```

The compiler receives four explicit, complete modes and returns only the selected public roles. Internal source tokens remain available during reference resolution but are absent from the selected compiled record and CSS output.

The application remains responsible for browser preference handling, theme state, persistence, controls, URLs, selector precedence, and media-query policy. Color parsing, conversion, color-gamut decisions, palette generation, and contrast policy also remain outside `scheme-tokens`; the graph stores and preserves the strings the application supplies.
