import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, unknown>>;
  readonly name: string;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly version: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-theme-coordinate-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

const tarball = pack(packDirectory);
writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    [manifest.name]: fileDependencySpec(consumerDirectory, tarball),
  },
});
writeJson(join(consumerDirectory, "tsconfig.json"), {
  compilerOptions: {
    strict: true,
    skipLibCheck: false,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    lib: ["ES2022"],
    types: [],
    resolveJsonModule: true,
    verbatimModuleSyntax: true,
    rootDir: ".",
    outDir: "dist",
  },
  include: ["consumer.ts"],
});

writeFileSync(
  join(consumerDirectory, "consumer.ts"),
  String.raw`
import tokenGraphSchema from "scheme-tokens/schemas/token-graph.v1.schema.json" with { type: "json" };
import packageManifest from "scheme-tokens/package.json" with { type: "json" };
import * as packageApi from "scheme-tokens";
import {
  compileTokenGraph,
  defineTokens,
  exportCssVars,
  serializeCompiledScheme,
  tokenRef,
  type CompiledScheme,
  type CssVarDeclaration,
} from "scheme-tokens";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type PaletteId = "mono" | "vivid";
type ResolvedScheme = "light" | "dark";
type CoordinateKey = "mono:light" | "mono:dark" | "vivid:light" | "vivid:dark";

const compilerModes = [
  "mono-light",
  "mono-dark",
  "vivid-light",
  "vivid-dark",
] as const;
type CompilerMode = (typeof compilerModes)[number];

const compilerModeByCoordinate = {
  "mono:light": "mono-light",
  "mono:dark": "mono-dark",
  "vivid:light": "vivid-light",
  "vivid:dark": "vivid-dark",
} as const satisfies Readonly<Record<CoordinateKey, CompilerMode>>;

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

const exactModeSelectors = {
  "mono-light": ":root",
  "mono-dark": ':root[data-scheme="dark"]',
  "vivid-light": ':root[data-palette="vivid"][data-scheme="light"]',
  "vivid-dark": ':root[data-palette="vivid"][data-scheme="dark"]',
} as const satisfies Readonly<Record<CompilerMode, string>>;

const expectedRuntimeExports = [
  "compileTokenGraph",
  "defineTokenGraph",
  "defineTokenLayer",
  "defineTokens",
  "exportCssVars",
  "parseCompiledScheme",
  "parseTokenGraph",
  "parseTokenLayer",
  "serializeCompiledScheme",
  "serializeTokenGraph",
  "serializeTokenLayer",
  "tokenRef",
] as const;

assertDeepEqual(Object.keys(packageApi).sort(), [...expectedRuntimeExports].sort(), "runtime exports");
assertEqual(packageManifest.name, "scheme-tokens", "package name");
assertEqual(packageManifest.version, "0.1.0", "package version");
assertEqual(
  tokenGraphSchema.$id,
  "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
  "schema package export",
);
assertEqual(
  compilerModeByCoordinate[coordinateKey("vivid", "dark")],
  "vivid-dark",
  "private coordinate adapter",
);

const first = projectTheme();
const second = projectTheme();

type SelectedRole = keyof typeof first.compiled.tokens;
type SelectedMode = (typeof first.compiled.modes)[number];
type SelectedRolesAreExact = Expect<Equal<SelectedRole, PublicRoleKey>>;
type SelectedModesAreExact = Expect<Equal<SelectedMode, CompilerMode>>;
const exactCompiledRecord: Readonly<
  Record<PublicRoleKey, Readonly<Record<CompilerMode, string>>>
> = first.compiled.tokens;
const exactVariableRecord: Readonly<Record<PublicRoleKey, string>> =
  first.exported.variableByToken;
void (0 as unknown as SelectedRolesAreExact);
void (0 as unknown as SelectedModesAreExact);
void exactCompiledRecord;
void exactVariableRecord;

// @ts-expect-error exact selection rejects roles outside the public contract
void first.compiled.tokens["surface.missing"];
// @ts-expect-error exact selection excludes internal source records
void first.compiled.tokens["source.paper"];
// @ts-expect-error compiled mode keys remain the exact private mode union
void first.compiled.tokens["surface.canvas"]["mono-sepia"];

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

const expectedBlockModes = ["mono-light", "mono-dark", "vivid-dark", "vivid-light"];
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
assertDeepEqual(
  first.exported.blocks.map((block) => block.mode),
  expectedBlockModes,
  "canonical block ordering",
);
for (const block of first.exported.blocks) {
  assertEqual(block.selector, exactModeSelectors[block.mode], "exact selector for " + block.mode);
  assertDeepEqual(
    block.declarations.map((declaration) => declaration.tokenKey),
    expectedDeclarationOrder,
    "canonical declaration ordering for " + block.mode,
  );
}

const monoLight = requiredBlock(first, "mono-light");
const monoDark = requiredBlock(first, "mono-dark");
const explicitLight = {
  selector: ':root[data-scheme="light"]',
  declarations: monoLight.declarations,
};
const fallbackDeclarations = monoDark.declarations;
if (explicitLight.declarations !== monoLight.declarations) {
  throw new Error("explicit light composition did not reuse canonical declarations");
}
if (fallbackDeclarations !== monoDark.declarations) {
  throw new Error("fallback composition did not reuse canonical declarations");
}

const explicitLightCss = formatBlock(explicitLight.selector, explicitLight.declarations);
const noScriptDarkCss = formatDarkFallback(fallbackDeclarations);
assertEqual(
  explicitLightCss,
  [
    ':root[data-scheme="light"] {',
    "  --app-action--primary--background: #1a1a1a;",
    "  --app-action--primary--foreground: #ffffff;",
    "  --app-content--muted: #5f6368;",
    "  --app-content--primary: #111111;",
    "  --app-focus--ring: currentColor;",
    "  --app-renderer--field: currentColor;",
    "  --app-renderer--signal: currentColor;",
    "  --app-selection--background: #1a1a1a;",
    "  --app-selection--foreground: #ffffff;",
    "  --app-surface--canvas: #ffffff;",
    "  --app-surface--default: #ffffff;",
    "}",
  ].join("\n"),
  "explicit light selector formatting",
);
assertEqual(
  noScriptDarkCss,
  [
    "@media (prefers-color-scheme: dark) {",
    "  :root:not([data-scheme]) {",
    "    --app-action--primary--background: #f0f0f0;",
    "    --app-action--primary--foreground: #111111;",
    "    --app-content--muted: #a0a4aa;",
    "    --app-content--primary: #f5f5f5;",
    "    --app-focus--ring: currentColor;",
    "    --app-renderer--field: currentColor;",
    "    --app-renderer--signal: currentColor;",
    "    --app-selection--background: #f0f0f0;",
    "    --app-selection--foreground: #111111;",
    "    --app-surface--canvas: #111111;",
    "    --app-surface--default: #111111;",
    "  }",
    "}",
  ].join("\n"),
  "no-script dark fallback formatting",
);

assertEqual(first.serialized, second.serialized, "compiled serialization determinism");
assertEqual(first.exported.css, second.exported.css, "CSS byte determinism");
assertEqual(first.blockSnapshot, second.blockSnapshot, "structured block determinism");
assertEqual(first.variableSnapshot, second.variableSnapshot, "variable mapping determinism");
assertEqual(explicitLightCss, second.explicitLightCss, "explicit light composition determinism");
assertEqual(noScriptDarkCss, second.noScriptDarkCss, "fallback composition determinism");

function projectTheme() {
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

  const compiled = expectOk(
    compileTokenGraph(graph, {
      selection: {
        keys: publicRoleKeys,
      },
    }),
    "compile exact public theme roles",
  );
  const exactContract: CompiledScheme<PublicRoleKey, CompilerMode, true> = compiled;
  void exactContract;

  const exported = expectOk(
    exportCssVars(compiled, {
      prefix: "app",
      modeSelectors: {
        strategy: "selectors",
        selectors: exactModeSelectors,
      },
      format: "pretty",
    }),
    "export exact theme selectors",
  );

  const monoLight = exported.blocks.find((block) => block.mode === "mono-light");
  const monoDark = exported.blocks.find((block) => block.mode === "mono-dark");
  if (monoLight === undefined || monoDark === undefined) {
    throw new Error("structured export omitted a required mono block");
  }

  return {
    compiled,
    exported,
    serialized: serializeCompiledScheme(compiled),
    blockSnapshot: JSON.stringify(exported.blocks),
    variableSnapshot: JSON.stringify(exported.variableByToken),
    explicitLightCss: formatBlock(
      ':root[data-scheme="light"]',
      monoLight.declarations,
    ),
    noScriptDarkCss: formatDarkFallback(monoDark.declarations),
  };
}

function coordinateKey(
  palette: PaletteId,
  scheme: ResolvedScheme,
): CoordinateKey {
  if (palette === "mono") {
    return scheme === "light" ? "mono:light" : "mono:dark";
  }
  return scheme === "light" ? "vivid:light" : "vivid:dark";
}

function requiredBlock(
  projection: ReturnType<typeof projectTheme>,
  mode: CompilerMode,
) {
  const block = projection.exported.blocks.find((candidate) => candidate.mode === mode);
  if (block === undefined) {
    throw new Error("missing CSS block for mode: " + mode);
  }
  return block;
}

function formatBlock(selector: string, declarations: readonly CssVarDeclaration[]): string {
  return [
    selector + " {",
    ...declarations.map((declaration) =>
      "  " + declaration.property + ": " + declaration.value + ";"
    ),
    "}",
  ].join("\n");
}

function formatDarkFallback(declarations: readonly CssVarDeclaration[]): string {
  return [
    "@media (prefers-color-scheme: dark) {",
    "  :root:not([data-scheme]) {",
    ...declarations.map((declaration) =>
      "    " + declaration.property + ": " + declaration.value + ";"
    ),
    "  }",
    "}",
  ].join("\n");
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
`,
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
run(
  process.execPath,
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);
run(process.execPath, [join("dist", "consumer.js")], consumerDirectory);

const installedManifest = JSON.parse(
  readFileSync(join(consumerDirectory, "node_modules", manifest.name, "package.json"), "utf8"),
) as PackageManifest;
assertEqual(installedManifest.name, "scheme-tokens", "installed package name");
assertEqual(installedManifest.version, "0.1.0", "installed package version");
assertDeepEqual(
  Object.keys(installedManifest.exports).sort(),
  [
    ".",
    "./package.json",
    "./schemas/compiled-scheme.v1.schema.json",
    "./schemas/token-graph.v1.schema.json",
    "./schemas/token-layer.v1.schema.json",
  ],
  "installed package exports",
);
for (const dependencyField of [
  installedManifest.dependencies,
  installedManifest.optionalDependencies,
  installedManifest.peerDependencies,
]) {
  if (Object.keys(dependencyField ?? {}).length > 0) {
    throw new Error("theme-coordinate consumer installed a package with runtime dependencies");
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      workspace,
      consumerDirectory,
      tarball,
      lifecycleScripts: "disabled during consumer install",
      modes: 4,
      selectedRoles: 11,
    },
    null,
    2,
  )}\n`,
);

function pack(destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination], repoRoot)
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (output === undefined) {
    throw new Error("Unable to determine packed tarball name");
  }
  return join(destination, basename(output));
}

function fileDependencySpec(fromDirectory: string, tarballPath: string): string {
  return `file:${relative(fromDirectory, tarballPath).replaceAll("\\", "/")}`;
}

function runPnpm(args: readonly string[], cwd: string): string {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath === undefined
    ? run("pnpm", args, cwd)
    : run(process.execPath, [npmExecPath, ...args], cwd);
}

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function assertEqual(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch\nactual: ${actual}\nexpected: ${expected}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}
