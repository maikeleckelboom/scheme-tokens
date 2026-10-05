import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllDocuments } from "yaml";

interface Dependency {
  readonly specifier: string;
  readonly version: string;
}

interface ArtifactResolution {
  readonly resolution: { readonly integrity: string; readonly tarball: string };
  readonly version: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

interface Snapshot {
  readonly dependencies?: Readonly<Record<string, string>>;
}

interface Lockfile {
  readonly lockfileVersion: string;
  readonly importers: Readonly<
    Record<
      string,
      {
        readonly dependencies?: Readonly<Record<string, Dependency>>;
        readonly devDependencies?: Readonly<Record<string, Dependency>>;
      }
    >
  >;
  readonly packages: Readonly<Record<string, ArtifactResolution>>;
  readonly snapshots: Readonly<Record<string, Snapshot>>;
}

const artifacts = [
  { name: "scheme-tokens", version: "0.4.1", filename: "scheme-tokens-0.4.1.tgz" },
  {
    name: "@scheme-tokens/material3",
    version: "0.2.0",
    filename: "scheme-tokens-material3-0.2.0.tgz",
  },
] as const;
const coreSpec = `file:vendor/scheme-tokens/${artifacts[0].filename}`;

/** Standalone pnpm v9 project importer. Runtime bytes need a separate fresh frozen install. */
export function checkConsumerCandidate(consumer: string): void {
  const root = resolve(consumer);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const provenance = JSON.parse(
    readFileSync(join(root, "vendor/scheme-tokens/provenance.json"), "utf8"),
  ) as {
    readonly artifacts: readonly { readonly filename: string; readonly sha256: string }[];
  };
  const documents = parseAllDocuments(readFileSync(join(root, "pnpm-lock.yaml"), "utf8"));
  for (const document of documents) {
    assert.equal(document.errors.length, 0, "Lockfile must be valid YAML with unique mapping keys");
  }
  // pnpm's optional env document precedes the project dependency graph.
  const lock = documents.at(-1)?.toJS() as Lockfile | undefined;
  assert.equal(
    lock?.lockfileVersion,
    "9.0",
    "Candidate checker supports pnpm lockfile version 9.0",
  );
  const importer = lock?.importers?.["."];
  assert(importer, "The intended project importer '.' is missing");
  for (const { name, version, filename } of artifacts) {
    const section = Object.hasOwn(manifest.dependencies ?? {}, name)
      ? "dependencies"
      : "devDependencies";
    const spec = `file:vendor/scheme-tokens/${filename}`;
    assert.equal(
      manifest[section]?.[name],
      spec,
      `${name} manifest must use the portable artifact`,
    );
    const dependency: Dependency | undefined = importer[section]?.[name];
    assert.equal(
      dependency?.specifier,
      spec,
      `${name} importer must specify its portable artifact`,
    );
    const resolution: string | undefined = dependency?.version;
    assert(
      resolution === spec ||
        (name === "@scheme-tokens/material3" &&
          resolution === `${spec}(scheme-tokens@${coreSpec})`),
      `${name} importer resolves the wrong artifact or peer`,
    );
    const entry: ArtifactResolution | undefined = lock?.packages?.[`${name}@${spec}`];
    assert(entry, `${name} artifact resolution is missing`);
    assert.equal(entry.version, version, `${name} lockfile package version`);
    assert.equal(entry.resolution?.tarball, spec, `${name} resolution must identify its artifact`);
    const bytes = readFileSync(join(root, "vendor/scheme-tokens", filename));
    const digest = createHash("sha256").update(bytes).digest("hex");
    const records = provenance.artifacts.filter((artifact) => artifact.filename === filename);
    assert.equal(records.length, 1, `${name} must have exactly one provenance digest`);
    assert.equal(records[0]?.sha256, digest, `${name} artifact provenance digest mismatch`);
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    assert.equal(entry.resolution.integrity, integrity, `${name} artifact integrity mismatch`);
    const snapshot: Snapshot | undefined = lock?.snapshots?.[`${name}@${resolution}`];
    assert(snapshot, `${name} resolved snapshot is missing`);
    if (name === "@scheme-tokens/material3") {
      assert.equal(
        entry.peerDependencies?.["scheme-tokens"],
        "^0.4.0",
        "Material lockfile peer range",
      );
      assert.equal(
        snapshot.dependencies?.["scheme-tokens"],
        coreSpec,
        "Material lockfile resolves the consumer's candidate core",
      );
    }
  }
  const require = createRequire(join(root, "package.json"));
  const corePath = require.resolve("scheme-tokens/package.json");
  const materialPath = require.resolve("@scheme-tokens/material3/package.json");
  const peerPath = createRequire(materialPath).resolve("scheme-tokens/package.json");
  assert.equal(
    realpathSync(peerPath),
    realpathSync(corePath),
    "Material resolves the same installed candidate core",
  );
  for (const [path, expected] of [
    [corePath, artifacts[0]],
    [materialPath, artifacts[1]],
  ] as const) {
    const installed = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(installed.name, expected.name, "Installed package identity");
    assert.equal(installed.version, expected.version, "Installed package version");
    if (expected.name === "@scheme-tokens/material3") {
      assert.equal(
        installed.peerDependencies?.["scheme-tokens"],
        "^0.4.0",
        "Installed Material peer range",
      );
    }
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const consumer = process.argv[2];
  if (consumer === undefined) {
    throw new Error("Usage: node scripts/check-consumer-candidate.ts <consumer-directory>");
  }
  checkConsumerCandidate(consumer);
  console.log(
    "Candidate digests, importer/artifact/integrity relationships, installed identities, and shared core passed. Runtime contents require a fresh frozen installation.",
  );
}
