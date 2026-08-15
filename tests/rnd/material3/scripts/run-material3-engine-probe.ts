import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";

const expectedEnginePackage = "@material/material-color-utilities";
const expectedEngineVersion = "0.4.0";
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureDirectory = join(packageRoot, "fixtures");
const mode = process.argv[2];

if (mode !== "--write" && mode !== "--check") {
  throw new Error(
    "Usage: node --experimental-strip-types scripts/run-material3-engine-probe.ts --write|--check",
  );
}

const engineManifest = readInstalledManifest(expectedEnginePackage);
if (engineManifest.version !== expectedEngineVersion) {
  throw new Error(
    `Expected ${expectedEnginePackage}@${expectedEngineVersion}, received ${engineManifest.version}.`,
  );
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "scheme-tokens-material3-rnd-"));
assertSafeTemporaryRoot(temporaryRoot);
const bundlePath = join(temporaryRoot, "material3-engine-probe.mjs");
const generatedDirectory = mode === "--write" ? fixtureDirectory : join(temporaryRoot, "generated");

try {
  await build({
    entryPoints: [join(packageRoot, "scripts", "material3-engine-probe.ts")],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    sourcemap: false,
    logLevel: "silent",
    define: {
      __MATERIAL_COLOR_UTILITIES_VERSION__: JSON.stringify(engineManifest.version),
    },
  });

  const probe = (await import(
    `${pathToFileURL(bundlePath).href}?generated=${Date.now()}`
  )) as BundledProbe;
  const summary = probe.generateMaterial3Evidence(generatedDirectory);

  if (mode === "--check") {
    verifyCommittedEvidence(summary.generatedFiles, generatedDirectory, fixtureDirectory);
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  rmSync(resolve(temporaryRoot), { recursive: true, force: true });
}

interface PackageManifest {
  readonly name: string;
  readonly version: string;
}

interface BundledProbe {
  readonly generateMaterial3Evidence: (outputDirectory: string) => {
    readonly generatedFiles: readonly string[];
    readonly [key: string]: unknown;
  };
}

function readInstalledManifest(packageName: string): PackageManifest {
  const require = createRequire(import.meta.url);
  let current = dirname(require.resolve(packageName));
  const root = parse(current).root;
  while (current !== root) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      const manifest = JSON.parse(readFileSync(candidate, "utf8")) as Partial<PackageManifest>;
      if (manifest.name === packageName && typeof manifest.version === "string") {
        return { name: manifest.name, version: manifest.version };
      }
    }
    current = dirname(current);
  }
  throw new Error(`Unable to locate installed manifest for ${packageName}.`);
}

function verifyCommittedEvidence(
  expectedFiles: readonly string[],
  generatedRoot: string,
  committedRoot: string,
): void {
  const committedFiles = readdirSync(committedRoot)
    .filter((file) => file.endsWith(".json"))
    .sort(compareCodeUnits);
  const sortedExpectedFiles = [...expectedFiles].sort(compareCodeUnits);
  if (JSON.stringify(committedFiles) !== JSON.stringify(sortedExpectedFiles)) {
    throw new Error(
      `Committed Material 3 R&D fixture set drifted. Expected ${sortedExpectedFiles.join(", ")}; received ${committedFiles.join(", ")}.`,
    );
  }

  for (const file of sortedExpectedFiles) {
    const generated = readFileSync(join(generatedRoot, file));
    const committed = readFileSync(join(committedRoot, file));
    if (!generated.equals(committed)) {
      throw new Error(`Committed Material 3 R&D evidence is stale: ${file}.`);
    }
  }
}

function assertSafeTemporaryRoot(path: string): void {
  const resolvedTemporaryRoot = resolve(path);
  const resolvedSystemTemp = resolve(tmpdir());
  if (
    dirname(resolvedTemporaryRoot) !== resolvedSystemTemp ||
    !parse(resolvedTemporaryRoot).base.startsWith("scheme-tokens-material3-rnd-")
  ) {
    throw new Error(`Refusing to use unexpected temporary directory: ${resolvedTemporaryRoot}`);
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
