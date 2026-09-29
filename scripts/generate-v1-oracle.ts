import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { comparableV1Output, evidenceDigest } from "./v1-oracle-evidence.ts";
import {
  oracleCaseCount,
  oracleSeed,
  randomizedV1Cases,
  representativeV1Cases,
} from "./v1-oracle-cases.ts";

const expectedIntegrity =
  "sha512-SqZXKq90uz3ccax4cUDKlRGzckxDJ7T/kWcPiv0gOceVIgFz92yjq6hObcRDRrt7581nqwpnB8bQQ2KXM2oCDA==";
const expectedShasum = "8ce57052b08bbe01536b042168a7480427a6455c";
const tarballArgument = process.argv[2];
if (tarballArgument === undefined) {
  throw new Error("Pass the downloaded scheme-tokens-0.3.0.tgz path");
}
const tarball = resolve(tarballArgument);
const bytes = readFileSync(tarball);
const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const shasum = createHash("sha1").update(bytes).digest("hex");
if (integrity !== expectedIntegrity || shasum !== expectedShasum) {
  throw new Error("Tarball does not match the published scheme-tokens@0.3.0 artifact");
}

const workspace = mkdtempSync(join(tmpdir(), "scheme-tokens-v1-oracle-"));
try {
  execFileSync("tar", ["-xzf", tarball, "-C", workspace]);
  const packageRoot = join(workspace, "package");
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
    readonly name: string;
    readonly version: string;
  };
  if (manifest.name !== "scheme-tokens" || manifest.version !== "0.3.0") {
    throw new Error("Extracted package manifest does not identify scheme-tokens@0.3.0");
  }
  const published = (await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href)) as {
    readonly parseTokenGraph: (
      input: unknown,
    ) =>
      | { readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly issues: unknown };
    readonly compileTokenGraph: (
      graph: unknown,
      options: { readonly selection: "all" | "public" },
    ) =>
      | { readonly ok: true; readonly value: Parameters<typeof comparableV1Output>[0] }
      | { readonly ok: false; readonly issues: unknown };
    readonly serializeTokenGraph: (graph: unknown) => string;
    readonly serializeCompiledScheme: (scheme: unknown) => string;
  };
  const compile = (input: unknown, selection: "all" | "public") => {
    const parsed = published.parseTokenGraph(input);
    if (!parsed.ok) {
      throw new Error(
        `Published parser rejected a valid oracle case: ${JSON.stringify(parsed.issues)}`,
      );
    }
    const compiled = published.compileTokenGraph(parsed.value, { selection });
    if (!compiled.ok) {
      throw new Error(
        `Published compiler rejected a valid oracle case: ${JSON.stringify(compiled.issues)}`,
      );
    }
    return { parsed: parsed.value, compiled: compiled.value };
  };
  const representative = representativeV1Cases().map(({ id, input }) => {
    const all = compile(input, "all");
    const publicResult = compile(input, "public");
    return {
      id,
      input,
      normalizedGraph: JSON.parse(published.serializeTokenGraph(all.parsed)) as unknown,
      compiledAll: JSON.parse(published.serializeCompiledScheme(all.compiled)) as unknown,
      compiledPublic: JSON.parse(
        published.serializeCompiledScheme(publicResult.compiled),
      ) as unknown,
    };
  });
  const cases = randomizedV1Cases();
  const digests = cases.map(({ input }) =>
    evidenceDigest(comparableV1Output(compile(input, "all").compiled)),
  );
  const evidence = {
    artifact: {
      name: "scheme-tokens",
      version: "0.3.0",
      tarball: "https://registry.npmjs.org/scheme-tokens/-/scheme-tokens-0.3.0.tgz",
      integrity: expectedIntegrity,
      shasum: expectedShasum,
    },
    seed: oracleSeed,
    caseCount: oracleCaseCount,
    inputDigest: evidenceDigest(cases.map(({ input }) => input)),
    representative,
    randomizedOutputDigests: digests,
  };
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const output = join(root, "tests", "oracle", "published-0.3.0.json");
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`Wrote ${output} from published scheme-tokens@0.3.0\n`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
