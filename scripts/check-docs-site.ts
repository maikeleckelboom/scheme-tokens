import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageManifest {
  readonly version: string;
}

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const docsSiteRoot = join(repoRoot, "docs-site");
const docsRequire = createRequire(join(docsSiteRoot, "package.json"));
const configPath = join(docsSiteRoot, ".vitepress", "config.ts");
const themePath = join(docsSiteRoot, ".vitepress", "theme", "index.ts");
const themeCoordinateGuidePath = join(docsSiteRoot, "guide", "application-theme-coordinates.md");
const cachePath = join(docsSiteRoot, ".vitepress", "cache");
const distPath = join(docsSiteRoot, ".vitepress", "dist");

assertInstalledVersion("vitepress", "2.0.0-alpha.17");
assertInstalledVersion("@shikijs/vitepress-twoslash", "4.2.0");
assertInstalledVersion("typescript", "6.0.3");

const config = readFileSync(configPath, "utf8");
assertContains(config, "transformerTwoslash", configPath);
assertContains(config, "createFileSystemTypesCache", configPath);
assertContains(config, "explicitTrigger: true", configPath);
assertContains(config, "throws: true", configPath);
assertContains(config, 'link: "/guide/application-theme-coordinates"', configPath);
assertNotContains(config, "as any", configPath);
assertNotContains(config, "as unknown as", configPath);
assertNotContains(config, "@ts-ignore", configPath);
assertNotContains(config, "@ts-expect-error", configPath);

const themeCoordinateGuide = readFileSync(themeCoordinateGuidePath, "utf8");
assertContains(
  themeCoordinateGuide,
  "<!--@include: ../../docs/application-theme-coordinates.md-->",
  themeCoordinateGuidePath,
);

const theme = readFileSync(themePath, "utf8");
assertContains(theme, "@shikijs/vitepress-twoslash/client", themePath);
assertContains(theme, "@shikijs/vitepress-twoslash/style.css", themePath);

assertPackageImportExamplesUseTwoslash();

rmSync(cachePath, { force: true, recursive: true });
rmSync(distPath, { force: true, recursive: true });

runPnpm(["--filter", "@scheme-tokens/docs", "build"], repoRoot);

const indexHtml = join(distPath, "index.html");
if (!existsSync(indexHtml)) {
  throw new Error(`Docs build did not create ${indexHtml}`);
}

function assertInstalledVersion(packageName: string, expected: string): void {
  const manifestPath = resolvePackageManifestPath(packageName);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
  if (manifest.version !== expected) {
    throw new Error(`${packageName} resolved to ${manifest.version}; expected ${expected}`);
  }
}

function resolvePackageManifestPath(packageName: string): string {
  let directory = dirname(docsRequire.resolve(packageName));
  while (true) {
    const manifestPath = join(directory, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as
        | (PackageManifest & { readonly name?: string })
        | undefined;
      if (manifest?.name === packageName) {
        return manifestPath;
      }
    }

    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Unable to find package.json for ${packageName}`);
    }
    directory = parent;
  }
}

function assertContains(text: string, expected: string, file: string): void {
  if (!text.includes(expected)) {
    throw new Error(`${file} is missing ${expected}`);
  }
}

function assertNotContains(text: string, denied: string, file: string): void {
  if (text.includes(denied)) {
    throw new Error(`${file} must not contain ${denied}`);
  }
}

function assertPackageImportExamplesUseTwoslash(): void {
  const publicFiles = listMarkdownFiles(docsSiteRoot).filter(
    (file) => !file.replaceAll("\\", "/").includes("/.vitepress/"),
  );
  let twoslashExampleCount = 0;

  for (const file of publicFiles) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```/gm)) {
      const info = normalizeFenceInfo(match[1] ?? "");
      const code = match[2] ?? "";
      if (!code.includes('from "scheme-tokens"') && !code.includes("from 'scheme-tokens'")) {
        continue;
      }
      if (info !== "ts twoslash") {
        throw new Error(`Package import examples must use "ts twoslash" fences in ${file}`);
      }
      twoslashExampleCount += 1;
    }
  }

  if (twoslashExampleCount === 0) {
    throw new Error("Docs site must contain at least one twoslash package import example");
  }
}

function normalizeFenceInfo(info: string): string {
  return info.trim().replace(/\s+/g, " ").toLowerCase();
}

function listMarkdownFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules") {
      return [];
    }
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listMarkdownFiles(path);
    }
    return path.endsWith(".md") ? [path] : [];
  });
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
