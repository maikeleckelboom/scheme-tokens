import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly name: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const adapterRoot = join(repoRoot, "packages", "material3");
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const adapterManifest = JSON.parse(
  readFileSync(join(adapterRoot, "package.json"), "utf8"),
) as PackageManifest;
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const adapterReadme = readFileSync(join(adapterRoot, "README.md"), "utf8");
assertNoRemovedPublicNames();
assertTailwindRecipe(readme);

const blocks = extractTypeScriptExamples([
  { label: "README.md", text: readme },
  { label: "packages/material3/README.md", text: adapterReadme },
]);
if (blocks.length === 0) {
  throw new Error("Public READMEs contain no executable TypeScript examples");
}

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-docs-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });
const tarball = pack(repoRoot, packDirectory);
const dependencies: Record<string, string> = {
  [manifest.name]: `file:${tarball.replaceAll("\\", "/")}`,
};

if (blocks.some((block) => block.code.includes(adapterManifest.name))) {
  const adapterTarball = pack(adapterRoot, packDirectory);
  dependencies[adapterManifest.name] = `file:${adapterTarball.replaceAll("\\", "/")}`;
}

writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies,
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
  include: ["example-*.ts"],
});
blocks.forEach((block, index) => {
  writeFileSync(join(consumerDirectory, `example-${index}.ts`), block.code);
});

runPnpm(["install", "--ignore-scripts"], consumerDirectory);
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
    throw new Error("Unable to determine packed tarball name");
  }
  return join(destination, basename(output));
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

interface MarkdownFile {
  readonly label: string;
  readonly text: string;
}

interface TypeScriptExample {
  readonly code: string;
}

function extractTypeScriptExamples(files: readonly MarkdownFile[]): readonly TypeScriptExample[] {
  const examples: TypeScriptExample[] = [];
  const supportedInfos = new Set(["ts", "typescript", "ts twoslash"]);

  for (const file of files) {
    for (const match of file.text.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```/gm)) {
      const info = normalizeFenceInfo(match[1] ?? "");
      const code = match[2];
      if (code === undefined || info === "") {
        continue;
      }
      if (supportedInfos.has(info)) {
        examples.push({ code });
        continue;
      }
      if (/^tsx\b/.test(info)) {
        throw new Error(
          `Unsupported docs fence info "${match[1]}" in ${file.label}: TSX fences are not supported by this checker`,
        );
      }
      if (/^(ts|tsx|typescript)\b/.test(info)) {
        throw new Error(`Unsupported TypeScript fence info "${match[1]}" in ${file.label}`);
      }
    }
  }

  return examples;
}

function normalizeFenceInfo(info: string): string {
  return info.trim().replace(/\s+/g, " ").toLowerCase();
}

function assertNoRemovedPublicNames(): void {
  const removedRootPackageName = `color-${"scheme"}-tokens`;
  const removedAdapterScope = `@color-${"scheme"}-tokens`;
  const removedWholeArtifactNames = [
    `build${"Token"}${"Set"}`,
    `serialize${"Token"}${"Set"}`,
    `Compiled${"Token"}${"Set"}`,
    `Build${"Token"}${"Set"}`,
    `token${"Set"}`,
    `token ${"set"}`,
    `token-${"set"}`,
    `compiled-${"token"}-${"set"}`,
    `exportCss${"Variables"}`,
    `exportCss${"Variable"}Blocks`,
    `exportCss${"Var"}Blocks`,
    `serialize${"Scheme"}`,
    `material3${"Source"}`,
    `source${"Color"}`,
  ] as const;
  const denied = [
    removedRootPackageName,
    removedAdapterScope,
    ...removedWholeArtifactNames,
    `@scheme-tokens/source-material3`,
    `@scheme-tokens/format-dtcg`,
    `@scheme-tokens/conversion-texel`,
    `@scheme-tokens/target-shadcn`,
  ] as const;
  const publicFiles = [
    join(repoRoot, "package.json"),
    join(adapterRoot, "package.json"),
    join(repoRoot, "README.md"),
    join(adapterRoot, "README.md"),
    join(repoRoot, "CHANGELOG.md"),
    join(repoRoot, "AGENTS.md"),
    ...listFiles(join(repoRoot, "docs")),
  ];

  for (const file of publicFiles) {
    const text = readFileSync(file, "utf8");
    for (const name of denied) {
      if (containsExactName(text, name)) {
        throw new Error(
          `Public docs or package metadata contain a removed name "${name}" in ${file}`,
        );
      }
    }
    if (/\bref\s*\(/.test(text)) {
      throw new Error(`Public docs must use tokenRef(...) instead of ref(...) in ${file}`);
    }
  }
}

function containsExactName(text: string, name: string): boolean {
  if (name.startsWith("@")) {
    return text.includes(name);
  }
  return new RegExp(`(?<![A-Za-z0-9_$-])${escapeRegExp(name)}(?![A-Za-z0-9_$-])`).test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertTailwindRecipe(readmeText: string): void {
  const requiredSnippets = [
    "## Tailwind v4",
    ":root {\n  --background:",
    "--primary-foreground:",
    "@theme inline",
    "--color-background: var(--background);",
    "--color-foreground: var(--foreground);",
    "--color-primary: var(--primary);",
    "--color-primary-foreground: var(--primary-foreground);",
    "Do not derive Tailwind colors by blindly remapping every exported declaration",
  ] as const;
  for (const snippet of requiredSnippets) {
    if (!readmeText.includes(snippet)) {
      throw new Error(`README Tailwind v4 recipe is missing: ${snippet}`);
    }
  }
  if (readmeText.includes('exportCssVars(compiled.value, { prefix: "color" })')) {
    throw new Error("README must not teach Tailwind by prefixing runtime CSS variables");
  }
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
