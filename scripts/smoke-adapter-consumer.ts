import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

const repoRoot = process.cwd();
const adapterRoot = join(repoRoot, "packages", "material3");
const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-smoke-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });

const coreTarball = pack(repoRoot, packDirectory);
const adapterTarball = pack(adapterRoot, packDirectory);
const coreSpec = fileDependencySpec(consumerDirectory, coreTarball);
const adapterSpec = fileDependencySpec(consumerDirectory, adapterTarball);

writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    "scheme-tokens": coreSpec,
    "@scheme-tokens/material3": adapterSpec,
  },
});
writeJson(join(consumerDirectory, "tsconfig.json"), {
  compilerOptions: {
    strict: true,
    skipLibCheck: false,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    target: "ES2022",
    noEmit: true,
    types: [],
  },
  include: ["types.ts"],
});
writeFileSync(
  join(consumerDirectory, "material3.mjs"),
  `
import { buildScheme, createSchemeBuilder, defineTokenLayer, tokenRef } from "scheme-tokens";
import { material3, material3Preset } from "@scheme-tokens/material3";

const application = defineTokenLayer({
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.background": tokenRef("material3.surface"),
    "app.foreground": tokenRef("material3.on-surface"),
    "app.success": tokenRef("material3.extended.success.color"),
  },
});

const built = buildScheme(
  material3(
    "#6750a4",
    { extendedColors: [{ name: "success", color: "#2e7d32" }] },
    { defaultVisibility: "internal" },
  ),
  { layers: [application], selection: "all" },
);

if (!built.ok) throw new Error(JSON.stringify(built.issues));
if (!("app.background" in built.value.tokens)) throw new Error("adapter layer composition failed");
if (!("app.success" in built.value.tokens)) throw new Error("adapter extended color composition failed");
if (built.value.tokens["material3.primary"]?.origin?.kind !== "source") {
  throw new Error("adapter source origin was not preserved");
}
if (built.value.tokens["material3.extended.success.color"]?.origin?.kind !== "source") {
  throw new Error("adapter extended color source origin was not preserved");
}
const builder = createSchemeBuilder({ layers: [application], selection: "all" });
const material = material3Preset(
  {
    variant: "tonal-spot",
    extendedColors: [{ name: "success", color: "#2e7d32" }],
  },
  { defaultVisibility: "internal" },
);
const preparedBuilt = builder.build(material("#6750a4"));
if (!preparedBuilt.ok) throw new Error(JSON.stringify(preparedBuilt.issues));
if (!("app.background" in preparedBuilt.value.tokens)) {
  throw new Error("adapter prepared build composition failed");
}
`,
);
writeFileSync(
  join(consumerDirectory, "dependency-model.mjs"),
  `
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const consumer = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
if (consumer.dependencies["@material/material-color-utilities"] !== undefined) {
  throw new Error("consumer directly depends on the Material engine");
}

const adapterPackagePath = require.resolve("@scheme-tokens/material3/package.json");
const adapter = JSON.parse(readFileSync(adapterPackagePath, "utf8"));
if (adapter.dependencies?.["@material/material-color-utilities"] !== undefined) {
  throw new Error("adapter depends on the lagging npm Material engine");
}
if (adapter.peerDependencies?.["scheme-tokens"] !== "^0.1.0") {
  throw new Error("adapter does not declare the release-compatible core peer dependency");
}
if (JSON.stringify(adapter.dependencies ?? {}).includes("workspace:")) {
  throw new Error("adapter runtime dependencies leak a workspace protocol");
}
const adapterEntryUrl = await import.meta.resolve("@scheme-tokens/material3");
const adapterBundle = readFileSync(new URL(adapterEntryUrl), "utf8");
if (
  !adapterBundle.includes("src/vendor/material-color-utilities") ||
  !adapterBundle.includes("SchemeCmf")
) {
  throw new Error("adapter did not bundle the vendored Material engine surface");
}
`,
);
writeFileSync(
  join(consumerDirectory, "types.ts"),
  `
import { buildScheme, createSchemeBuilder, type SchemeBuilder, type ColorTokenSource } from "scheme-tokens";
import {
  material3,
  material3Preset,
  type Material3ExtendedColorInput,
  type Material3GenerationOptions,
  type Material3Input,
  type Material3IntegrationOptions,
  type Material3Issue,
  type Material3Preset,
  type Material3Variant,
} from "@scheme-tokens/material3";

const extendedColor: Material3ExtendedColorInput = { name: "success", color: "#2e7d32" };
const variant: Material3Variant = "tonal-spot";
const input: Material3Input = {
  sourceColors: "#6750a4",
  variant,
  extendedColors: [extendedColor],
};
const source: ColorTokenSource<Material3Issue> = material3(input);
const generationOptions: Material3GenerationOptions = { variant };
const integrationOptions: Material3IntegrationOptions = { defaultVisibility: "internal" };
const preset: Material3Preset = material3Preset(generationOptions, integrationOptions);
const presetSource: ColorTokenSource<Material3Issue> = preset("#6750a4");
const builder: SchemeBuilder = createSchemeBuilder({});
const built = buildScheme(source);
const preparedBuilt = builder.build(presetSource);
if (built.ok) built.value.defaultMode.toUpperCase();
if (preparedBuilt.ok) preparedBuilt.value.defaultMode.toUpperCase();
`,
);

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
for (const script of ["material3.mjs", "dependency-model.mjs"]) {
  run("node", [script], consumerDirectory);
}
run(
  "node",
  [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
  consumerDirectory,
);

function pack(cwd: string, destination: string): string {
  const output = runPnpm(["pack", "--pack-destination", destination], cwd)
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (output === undefined) {
    throw new Error(`Unable to determine packed tarball name for ${cwd}`);
  }
  return join(destination, basename(output));
}

function fileDependencySpec(fromDirectory: string, tarball: string): string {
  return `file:${relative(fromDirectory, tarball).replaceAll("\\", "/")}`;
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
