import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { checkConsumerCandidate } from "../../scripts/check-consumer-candidate.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
const core = "scheme-tokens";
const material = "@scheme-tokens/material3";
const filenames: Readonly<Record<string, string>> = {
  [core]: "scheme-tokens-0.4.1.tgz",
  [material]: "scheme-tokens-material3-0.2.0.tgz",
};
const spec = (name: string) => `file:vendor/scheme-tokens/${filenames[name]}`;
const packageKey = (name: string) => `${name}@${spec(name)}`;
const materialVersion = `${spec(material)}(scheme-tokens@${spec(core)})`;
const materialSnapshot = `${material}@${materialVersion}`;

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

// These small byte/manifest fixtures exercise relationships; the integration gate uses real tarballs.
function fixture(section = "dependencies") {
  const root = mkdtempSync(join(tmpdir(), "scheme-tokens-lock-test-"));
  roots.push(root);
  writeJson(join(root, "package.json"), {
    private: true,
    [section]: { [core]: spec(core), [material]: spec(material) },
  });
  const packages: Record<
    string,
    {
      resolution: { tarball: string; integrity: string };
      version: string;
      peerDependencies?: Record<string, string>;
    }
  > = {};
  const artifacts = [core, material].map((name) => {
    const bytes = Buffer.from(`synthetic artifact: ${name}`);
    const filename = filenames[name]!;
    const path = join(root, "vendor", "scheme-tokens", filename);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
    const version = name === core ? "0.4.1" : "0.2.0";
    const peer = name === core ? {} : { peerDependencies: { [core]: "^0.4.0" } };
    packages[packageKey(name)] = {
      version,
      resolution: {
        tarball: spec(name),
        integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      },
      ...peer,
    };
    writeJson(join(root, "node_modules", name, "package.json"), { name, version, ...peer });
    return { filename, sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  writeJson(join(root, "vendor", "scheme-tokens", "provenance.json"), { artifacts });
  const importers: Record<
    string,
    Record<string, Record<string, { specifier: string; version: string }>>
  > = {
    ".": {
      [section]: {
        [core]: { specifier: spec(core), version: spec(core) },
        [material]: { specifier: spec(material), version: materialVersion },
      },
    },
  };
  const lock = {
    lockfileVersion: "9.0",
    importers,
    packages,
    snapshots: {
      [packageKey(core)]: {},
      [materialSnapshot]: { dependencies: { [core]: spec(core) } },
    },
  };
  const save = () => writeFileSync(join(root, "pnpm-lock.yaml"), stringify(lock));
  save();
  return { root, lock, save };
}

describe("structural candidate lockfile verification", () => {
  it.each(["dependencies", "devDependencies"])("accepts a valid paired %s importer", (section) => {
    const { root } = fixture(section);
    expect(() => checkConsumerCandidate(root)).not.toThrow();
  });

  it("uses the project document after an optional pnpm environment document", () => {
    const { root } = fixture();
    const path = join(root, "pnpm-lock.yaml");
    writeFileSync(
      path,
      `---\nlockfileVersion: '9.0'\nimporters: {.: {configDependencies: {}}}\n---\n${readFileSync(path, "utf8")}`,
    );
    expect(() => checkConsumerCandidate(root)).not.toThrow();
  });

  it("rejects swapped integrity assignments despite both strings being present", () => {
    const { root, lock, save } = fixture();
    const a = lock.packages[packageKey(core)]!.resolution;
    const b = lock.packages[packageKey(material)]!.resolution;
    [a.integrity, b.integrity] = [b.integrity, a.integrity];
    save();
    expect(() => checkConsumerCandidate(root)).toThrow("artifact integrity mismatch");
  });

  it.each(["specifier", "version"] as const)(
    "rejects a wrong importer %s with expected text in another importer",
    (field) => {
      const { root, lock, save } = fixture();
      lock.importers["reference"] = structuredClone(lock.importers["."]!);
      lock.importers["."]!["dependencies"]![core]![field] = "file:wrong.tgz";
      save();
      expect(() => checkConsumerCandidate(root)).toThrow(
        field === "specifier" ? "importer must specify" : "importer resolves the wrong artifact",
      );
    },
  );

  it.each(["missing", "mismatched"])("rejects a %s package resolution", (failure) => {
    const { root, lock, save } = fixture();
    if (failure === "missing") {
      delete lock.packages[packageKey(core)];
    } else {
      lock.packages[packageKey(core)]!.resolution.tarball = spec(material);
    }
    save();
    expect(() => checkConsumerCandidate(root)).toThrow(
      failure === "missing"
        ? "artifact resolution is missing"
        : "resolution must identify its artifact",
    );
  });

  it("rejects a missing peer-qualified snapshot", () => {
    const { root, lock, save } = fixture();
    delete lock.snapshots[materialSnapshot];
    save();
    expect(() => checkConsumerCandidate(root)).toThrow("resolved snapshot is missing");
  });

  it("rejects a tampered artifact before inspecting installed packages", () => {
    const { root } = fixture();
    writeFileSync(join(root, "vendor", "scheme-tokens", filenames[core]!), "tampered");
    expect(() => checkConsumerCandidate(root)).toThrow("artifact provenance digest mismatch");
  });

  it("rejects a different core in Material's lockfile snapshot", () => {
    const { root, lock, save } = fixture();
    lock.snapshots[materialSnapshot]!.dependencies![core] = "0.4.0";
    save();
    expect(() => checkConsumerCandidate(root)).toThrow(
      "Material lockfile resolves the consumer's candidate core",
    );
  });

  it("rejects a distinct installed core even with correct lockfile relationships", () => {
    const { root } = fixture();
    writeJson(join(root, "node_modules", material, "node_modules", core, "package.json"), {
      name: core,
      version: "0.4.0",
    });
    expect(() => checkConsumerCandidate(root)).toThrow("same installed candidate core");
  });

  it.each([
    [core, "name", "wrong", "identity"],
    [material, "version", "0.1.1", "version"],
    [material, "peerDependencies", { [core]: "^0.3.0" }, "peer range"],
  ])("rejects installed %s %s drift", (name, field, value, message) => {
    const { root } = fixture();
    const path = join(root, "node_modules", String(name), "package.json");
    writeJson(path, { ...JSON.parse(readFileSync(path, "utf8")), [String(field)]: value });
    expect(() => checkConsumerCandidate(root)).toThrow(String(message));
  });

  it("rejects duplicate YAML keys", () => {
    const { root } = fixture();
    const path = join(root, "pnpm-lock.yaml");
    const lock = parse(readFileSync(path, "utf8"));
    writeFileSync(path, `${stringify(lock)}\npackages: {}\n`);
    expect(() => checkConsumerCandidate(root)).toThrow("unique mapping keys");
  });
});
