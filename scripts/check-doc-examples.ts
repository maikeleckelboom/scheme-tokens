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
const adapterRoot = join(repoRoot, "packages", "source-material3");
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as PackageManifest;
const adapterManifest = JSON.parse(
  readFileSync(join(adapterRoot, "package.json"), "utf8"),
) as PackageManifest;
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
assertNoRemovedPublicNames();

const blocks: string[] = [];
for (const match of readme.matchAll(/```ts\n([\s\S]*?)```/g)) {
  const block = match[1];
  if (block !== undefined) {
    blocks.push(block);
  }
}
if (blocks.length === 0) {
  throw new Error("README contains no executable TypeScript examples");
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

if (blocks.some((block) => block.includes(adapterManifest.name))) {
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
  writeFileSync(join(consumerDirectory, `example-${index}.ts`), block);
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
  ] as const;
  const denied = [
    removedRootPackageName,
    removedAdapterScope,
    ...removedWholeArtifactNames,
  ] as const;
  const publicFiles = [
    join(repoRoot, "package.json"),
    join(adapterRoot, "package.json"),
    join(repoRoot, "README.md"),
    join(adapterRoot, "README.md"),
    ...listFiles(join(repoRoot, "docs")),
  ];

  for (const file of publicFiles) {
    const text = readFileSync(file, "utf8");
    for (const name of denied) {
      if (text.includes(name)) {
        throw new Error(`Public docs or package metadata contain a removed name in ${file}`);
      }
    }
  }
}

function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
