import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isGeneratedDocsSiteFile, isPointInTimeReport, listFiles } from "./public-docs.ts";

interface PackageManifest {
  readonly name: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const trackedWorkspaceFiles = listTrackedFiles(repoRoot);
const durableDocsFiles = listFiles(join(repoRoot, "docs")).filter(
  (file) => trackedWorkspaceFiles.has(file) && !isPointInTimeReport(file),
);
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const authoredDocsSiteFiles = listFiles(join(repoRoot, "docs-site")).filter(
  (file) => trackedWorkspaceFiles.has(file) && !isGeneratedDocsSiteFile(file),
);
const docsSiteFiles = authoredDocsSiteFiles.filter((file) => file.endsWith(".md"));
const publicMarkdownFiles = [
  { label: "README.md", text: readme },
  ...durableDocsFiles
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ label: file, text: readFileSync(file, "utf8") })),
  ...docsSiteFiles.map((file) => ({ label: file, text: readFileSync(file, "utf8") })),
];
assertNoRemovedPublicNames();
assertNoPublicColorParserSurface();
assertResultConvention(publicMarkdownFiles);
assertPackageImportExamplesUseTwoslash(publicMarkdownFiles);

const blocks = extractTypeScriptExamples(publicMarkdownFiles);
if (blocks.length === 0) {
  throw new Error("Public docs contain no executable TypeScript examples");
}

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-docs-"));
const packDirectory = join(workspace, "pack");
const consumerDirectory = join(workspace, "consumer");
mkdirSync(packDirectory, { recursive: true });
mkdirSync(consumerDirectory, { recursive: true });
const tarball = pack(repoRoot, packDirectory);

writeJson(join(consumerDirectory, "package.json"), {
  private: true,
  type: "module",
  dependencies: {
    [manifest.name]: `file:${tarball.replaceAll("\\", "/")}`,
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
    types: ["node"],
    typeRoots: [join(repoRoot, "node_modules", "@types")],
  },
  include: ["example-*.ts"],
});
blocks.forEach((block, index) => {
  writeFileSync(
    join(consumerDirectory, `example-${index}.ts`),
    `// Extracted from ${block.label.replaceAll("\\", "/")}\n${block.code}`,
  );
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
  readonly label: string;
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
        const isDurableDocsFile = file.label.includes(
          `${join(repoRoot, "docs")}${process.platform === "win32" ? "\\" : "/"}`,
        );
        if (info === "ts twoslash" || !isDurableDocsFile) {
          examples.push({ code, label: file.label });
        }
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

function assertPackageImportExamplesUseTwoslash(files: readonly MarkdownFile[]): void {
  for (const file of files) {
    for (const match of file.text.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```/gm)) {
      const info = normalizeFenceInfo(match[1] ?? "");
      const code = match[2] ?? "";
      if (!code.includes('from "scheme-tokens"') && !code.includes("from 'scheme-tokens'")) {
        continue;
      }
      if (info !== "ts twoslash") {
        throw new Error(`Package import examples must use "ts twoslash" fences in ${file.label}`);
      }
    }
  }
}

function assertNoRemovedPublicNames(): void {
  const removedRootPackageName = `color-${"scheme"}-tokens`;
  const removedAdapterScope = `@color-${"scheme"}-tokens`;
  const denied = [
    removedRootPackageName,
    removedAdapterScope,
    `@scheme-tokens/material3`,
    `@scheme-tokens/source-material3`,
    `build${"Scheme"}`,
    `create${"Scheme"}Builder`,
    `Color${"Token"}Source`,
    `Color${"Token"}GraphInput`,
    `Color${"Token"}LayerInput`,
    `Color${"Expression"}Input`,
    `Compiled${"Color"}Scheme`,
    `parse${"Color"}`,
    `format${"Css"}${"Color"}`,
  ] as const;
  const publicFiles = [
    join(repoRoot, "package.json"),
    join(repoRoot, "README.md"),
    join(repoRoot, "CHANGELOG.md"),
    ...durableDocsFiles,
    ...authoredDocsSiteFiles,
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
  }
}

function assertResultConvention(files: readonly MarkdownFile[]): void {
  const corpus = files.map((file) => file.text).join("\n");
  for (const required of [
    "Result<Value, Problem>",
    "parsed.value",
    "compiled.value",
    "exported.value.css",
  ]) {
    if (!corpus.includes(required)) {
      throw new Error(`Public docs do not demonstrate the required Result convention: ${required}`);
    }
  }

  if (!readme.includes("compiled.value") || !readme.includes("exported.value.css")) {
    throw new Error("README first paths must demonstrate Result success payloads under .value");
  }

  for (const file of files) {
    for (const match of file.text.matchAll(/^```ts twoslash\r?\n([\s\S]*?)^```/gm)) {
      const code = match[1] ?? "";
      const removedSuccessAccess = code.match(
        /\b(?:compiled|parsed|exported)\.(?:graph|layer|scheme|css|blocks|variableByToken)\b/u,
      );
      if (removedSuccessAccess !== null) {
        throw new Error(
          `Current package example uses removed operation-specific success access "${removedSuccessAccess[0]}" in ${file.label}`,
        );
      }
    }
  }
}

function containsExactName(text: string, name: string): boolean {
  if (name.startsWith("@") || name.endsWith("<")) {
    return text.includes(name);
  }
  return new RegExp(`(?<![A-Za-z0-9_$-])${escapeRegExp(name)}(?![A-Za-z0-9_$-])`).test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertNoPublicColorParserSurface(): void {
  const publicFiles = [
    join(repoRoot, "README.md"),
    join(repoRoot, "CHANGELOG.md"),
    ...durableDocsFiles,
    ...authoredDocsSiteFiles,
  ].filter((file) => file.endsWith(".md"));

  const deniedSnippets = [
    "parseColor",
    "formatCssColor",
    "colorSpaces",
    "ColorValue",
    "ColorValueInput",
    "color parser",
    "high-gamut",
    "gamut mapping",
  ] as const;

  for (const file of publicFiles) {
    const text = readFileSync(file, "utf8");
    for (const snippet of deniedSnippets) {
      if (text.includes(snippet)) {
        throw new Error(`Public docs contain removed color surface "${snippet}" in ${file}`);
      }
    }
  }
}

function listTrackedFiles(root: string): ReadonlySet<string> {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  return new Set(
    output
      .split("\0")
      .filter((file) => file.length > 0)
      .map((file) => join(root, file)),
  );
}
