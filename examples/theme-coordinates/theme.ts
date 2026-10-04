/**
 * Executable reference consumer for application-owned theme coordinates.
 * The packed-consumer gate copies this file byte-for-byte before compiling and running it.
 */
import tokenGraphSchema from "scheme-tokens/schemas/token-graph.v2.schema.json" with { type: "json" };
import packageManifest from "scheme-tokens/package.json" with { type: "json" };
import * as packageApi from "scheme-tokens";
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  serializeCompiledScheme,
  tokenRef,
  type CompiledScheme,
  type CssVarBlock,
  type ExportCssVarsOptions,
} from "scheme-tokens";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

// Palette and resolved scheme stay independent in application state.
type PaletteId = "mono" | "vivid";
type ResolvedScheme = "light" | "dark";
type CoordinateKey = "mono:light" | "mono:dark" | "vivid:light" | "vivid:dark";

// Authored from general to specific: when several conditions match one element, the later mode
// wins, so the vivid modes come after the mono modes they refine.
const compilerModes = ["mono-light", "mono-dark", "vivid-light", "vivid-dark"] as const;
type CompilerMode = (typeof compilerModes)[number];

const compilerModeByCoordinate = {
  "mono:light": "mono-light",
  "mono:dark": "mono-dark",
  "vivid:light": "vivid-light",
  "vivid:dark": "vivid-dark",
} as const satisfies Readonly<Record<CoordinateKey, CompilerMode>>;

// Exact selection turns the downstream semantic role contract into a complete record.
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
type PublicRoleKey = (typeof publicRoleKeys)[number];

// The application owns two attributes on the themed element: `data-palette` (absent means mono)
// and `data-scheme` (absent means follow the system preference). The exporter only needs the
// media fallback and ordered selector conditions; `:not()` keeps the vivid system fallback from
// overriding an explicit light choice.
const activation = {
  activation: {
    media: { "mono-dark": "(prefers-color-scheme: dark)" },
    selectors: {
      "mono-light": '[data-scheme="light"]',
      "mono-dark": '[data-scheme="dark"]',
      "vivid-light": '[data-palette="vivid"]',
      "vivid-dark": [
        {
          selector: '[data-palette="vivid"]:not([data-scheme="light"])',
          media: "(prefers-color-scheme: dark)",
        },
        { selector: '[data-palette="vivid"][data-scheme="dark"]' },
      ],
    },
  },
  prefix: "app",
  format: "pretty",
} as const satisfies ExportCssVarsOptions<PublicRoleKey, CompilerMode>;

// These assertions also keep the example honest when it runs against the packed artifact.
const expectedRuntimeExports = [
  "compileTokenGraph",
  "defineTokenGraph",
  "defineTokenLayer",
  "exportCssVars",
  "parseCompiledScheme",
  "parseTokenGraph",
  "parseTokenLayer",
  "orThrow",
  "tokenConcat",
  "serializeCompiledScheme",
  "serializeTokenGraph",
  "serializeTokenLayer",
  "tokenRef",
] as const;

assertDeepEqual(
  Object.keys(packageApi).sort(),
  [...expectedRuntimeExports].sort(),
  "runtime exports",
);
assertEqual(packageManifest.name, "scheme-tokens", "package name");
assertEqual(
  tokenGraphSchema.$id,
  "tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2",
  "schema package export",
);
assertEqual(
  compilerModeByCoordinate[coordinateKey("vivid", "dark")],
  "vivid-dark",
  "private coordinate adapter",
);

const first = projectTheme();
const second = projectTheme();

// The selected roles and flattened modes remain exact literal unions.
type SelectedRole = keyof typeof first.compiled.tokens;
type SelectedMode = (typeof first.compiled.modes)[number];
type SelectedRolesAreExact = Expect<Equal<SelectedRole, PublicRoleKey>>;
type SelectedModesAreExact = Expect<Equal<SelectedMode, CompilerMode>>;
type BlockModesAreExact = Expect<
  Equal<(typeof first.exported.blocks)[number]["mode"], CompilerMode>
>;
const exactCompiledRecord: Readonly<Record<PublicRoleKey, Readonly<Record<CompilerMode, string>>>> =
  first.compiled.tokens;
const exactVariableRecord: Readonly<Record<PublicRoleKey, string>> = first.exported.variableByToken;
void (0 as unknown as SelectedRolesAreExact);
void (0 as unknown as SelectedModesAreExact);
void (0 as unknown as BlockModesAreExact);
void exactCompiledRecord;
void exactVariableRecord;

// @ts-expect-error exact selection rejects roles outside the public contract
void first.compiled.tokens["surface.missing"];
// @ts-expect-error exact selection excludes internal source records
void first.compiled.tokens["source.paper"];
// @ts-expect-error compiled mode keys remain the exact private mode union
void first.compiled.tokens["surface.canvas"]["mono-sepia"];
const unknownModeCondition: ExportCssVarsOptions<PublicRoleKey, CompilerMode> = {
  activation: {
    media: {
      // @ts-expect-error activation conditions are keyed by the exact private mode union
      "mono-sepia": "print",
    },
  },
};
void unknownModeCondition;

for (const role of publicRoleKeys) {
  for (const mode of compilerModes) {
    if (first.compiled.tokens[role][mode] === undefined) {
      throw new Error("selected role is incomplete: " + role + " / " + mode);
    }
  }
}

for (const sourceKey of ["source.paper", "source.ink", "source.primary", "source.signal"]) {
  if (sourceKey in first.compiled.tokens) {
    throw new Error("exact selection exposed internal source token: " + sourceKey);
  }
  if (first.exported.css.includes(sourceKey) || first.exported.css.includes("--app-source")) {
    throw new Error("CSS export exposed internal source token: " + sourceKey);
  }
}

assertEqual(
  first.compiled.tokens["surface.canvas"]["mono-dark"],
  "#111111",
  "internal source reference resolution",
);
assertEqual(
  first.compiled.tokens["action.primary.background"]["vivid-light"],
  "#5b45d6",
  "mode-specific internal source reference",
);
assertEqual(
  first.compiled.tokens["renderer.signal"]["mono-light"],
  first.compiled.tokens["renderer.signal"]["vivid-dark"],
  "shared value across modes",
);
assertEqual(
  first.exported.variableByToken["action.primary.background"],
  "--app-action-primary-background",
  "single-hyphen variable name",
);

// Tier order, then authored mode order, then condition order.
assertDeepEqual(
  first.exported.blocks.map((block) => [
    block.tier,
    block.mode,
    block.selectors,
    block.media ?? null,
  ]),
  [
    ["default", "mono-light", [":root"], null],
    ["media", "mono-dark", [":root"], "(prefers-color-scheme: dark)"],
    ["selector", "mono-light", ['[data-scheme="light"]'], null],
    ["selector", "mono-dark", ['[data-scheme="dark"]'], null],
    ["selector", "vivid-light", ['[data-palette="vivid"]'], null],
    [
      "selector",
      "vivid-dark",
      ['[data-palette="vivid"]:not([data-scheme="light"])'],
      "(prefers-color-scheme: dark)",
    ],
    ["selector", "vivid-dark", ['[data-palette="vivid"][data-scheme="dark"]'], null],
  ],
  "activation block ordering",
);

// Every block is complete: a later matching block replaces every declaration of an earlier one.
const expectedDeclarationOrder = [
  "action.primary.background",
  "action.primary.foreground",
  "content.muted",
  "content.primary",
  "focus.ring",
  "renderer.field",
  "renderer.signal",
  "selection.background",
  "selection.foreground",
  "surface.canvas",
  "surface.default",
];
for (const block of first.exported.blocks) {
  assertDeepEqual(
    block.declarations.map((declaration) => declaration.tokenKey),
    expectedDeclarationOrder,
    "complete canonical declarations for " + block.tier + " " + block.mode,
  );
  for (const declaration of block.declarations) {
    assertEqual(
      declaration.value,
      first.compiled.tokens[declaration.tokenKey][block.mode],
      "declaration value for " + declaration.tokenKey + " in " + block.mode,
    );
  }
}

// The exporter now emits the no-script system fallback itself.
assertEqual(
  first.exported.css.split("\n\n")[1] ?? "",
  [
    "@media (prefers-color-scheme: dark) {",
    "  :where(:root) {",
    "    --app-action-primary-background: #f0f0f0;",
    "    --app-action-primary-foreground: #111111;",
    "    --app-content-muted: #a0a4aa;",
    "    --app-content-primary: #f5f5f5;",
    "    --app-focus-ring: currentColor;",
    "    --app-renderer-field: currentColor;",
    "    --app-renderer-signal: currentColor;",
    "    --app-selection-background: #f0f0f0;",
    "    --app-selection-foreground: #111111;",
    "    --app-surface-canvas: #111111;",
    "    --app-surface-default: #111111;",
    "  }",
    "}",
  ].join("\n"),
  "system fallback formatting",
);

// Structured blocks describe the stylesheet completely: an application can re-emit them, for
// example inside its own wrapper, without parsing the generated CSS.
assertEqual(formatBlocks(first.exported.blocks), first.exported.css, "structured block reuse");

assertEqual(first.serialized, second.serialized, "compiled serialization determinism");
assertEqual(first.exported.css, second.exported.css, "CSS byte determinism");
assertEqual(first.blockSnapshot, second.blockSnapshot, "structured block determinism");
assertEqual(first.variableSnapshot, second.variableSnapshot, "variable mapping determinism");

// Complete private modes compose at the compiler boundary; internal sources resolve before
// exact public selection removes them from the output.
function projectTheme() {
  const graph = defineTokenGraph({
    modes: compilerModes,
    defaultMode: "mono-light",
    tokens: {
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
  });

  const compiled = expectOk(
    compileTokenGraph(graph, {
      selection: publicRoleKeys,
    }),
    "compile exact public theme roles",
  );
  const exactContract: CompiledScheme<PublicRoleKey, CompilerMode, true> = compiled;
  void exactContract;

  const exported = expectOk(exportCssVars(compiled, activation), "export theme activation");

  return {
    compiled,
    exported,
    serialized: serializeCompiledScheme(compiled),
    blockSnapshot: JSON.stringify(exported.blocks),
    variableSnapshot: JSON.stringify(exported.variableByToken),
  };
}

function coordinateKey(palette: PaletteId, scheme: ResolvedScheme): CoordinateKey {
  if (palette === "mono") {
    return scheme === "light" ? "mono:light" : "mono:dark";
  }
  return scheme === "light" ? "vivid:light" : "vivid:dark";
}

function formatBlocks(blocks: readonly CssVarBlock[]): string {
  const rules = blocks.map((block) => {
    const depth = block.media === undefined ? 0 : 1;
    const rule = [
      "  ".repeat(depth) + ":where(" + block.selectors.join(", ") + ") {",
      ...block.declarations.map(
        (declaration) =>
          "  ".repeat(depth + 1) + declaration.property + ": " + declaration.value + ";",
      ),
      "  ".repeat(depth) + "}",
    ];
    return (block.media === undefined ? rule : ["@media " + block.media + " {", ...rule, "}"]).join(
      "\n",
    );
  });
  return rules.join("\n\n") + "\n";
}

function expectOk<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly issues: readonly unknown[] },
  label: string,
): Value {
  if (!result.ok) {
    throw new Error(label + " failed: " + JSON.stringify(result.issues));
  }
  return result.value;
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(label + " mismatch\nactual: " + actual + "\nexpected: " + expected);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}
