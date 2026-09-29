import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { compileTokenGraph, parseTokenGraph, serializeTokenGraph } from "../../src";
import { comparableV1Output, evidenceDigest } from "../../scripts/v1-oracle-evidence.ts";
import {
  oracleCaseCount,
  oracleSeed,
  randomizedV1Cases,
  representativeV1Cases,
} from "../../scripts/v1-oracle-cases.ts";

interface RepresentativeEvidence {
  readonly id: string;
  readonly input: unknown;
  readonly normalizedGraph: unknown;
  readonly compiledAll: Parameters<typeof comparableV1Output>[0];
  readonly compiledPublic: Parameters<typeof comparableV1Output>[0];
}

interface OracleEvidence {
  readonly artifact: { readonly integrity: string; readonly shasum: string };
  readonly seed: number;
  readonly caseCount: number;
  readonly inputDigest: string;
  readonly representative: readonly RepresentativeEvidence[];
  readonly randomizedOutputDigests: readonly string[];
}

const evidence = JSON.parse(
  readFileSync(fileURLToPath(new URL("./published-0.3.0.json", import.meta.url)), "utf8"),
) as OracleEvidence;

function compile(input: unknown, selection: "all" | "public") {
  const parsed = parseTokenGraph(input);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(JSON.stringify(parsed.issues));
  }
  const compiled = compileTokenGraph(parsed.value, { selection });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.issues));
  }
  return { parsed: parsed.value, compiled: compiled.value };
}

describe("published scheme-tokens@0.3.0 oracle", () => {
  test("representative v1 artifacts upgrade with unchanged published semantics", () => {
    expect(evidence.artifact.shasum).toBe("8ce57052b08bbe01536b042168a7480427a6455c");
    expect(evidence.artifact.integrity).toBe(
      "sha512-SqZXKq90uz3ccax4cUDKlRGzckxDJ7T/kWcPiv0gOceVIgFz92yjq6hObcRDRrt7581nqwpnB8bQQ2KXM2oCDA==",
    );
    expect(evidence.representative.map(({ id }) => id)).toEqual(
      representativeV1Cases().map(({ id }) => id),
    );
    for (const record of evidence.representative) {
      const all = compile(record.input, "all");
      const publicResult = compile(record.input, "public");
      expect(all.parsed.formatVersion).toBe(2);
      expect(parseTokenGraph(JSON.parse(serializeTokenGraph(all.parsed)))).toEqual({
        ok: true,
        value: all.parsed,
      });
      expect(comparableV1Output(all.compiled)).toEqual(comparableV1Output(record.compiledAll));
      expect(comparableV1Output(publicResult.compiled)).toEqual(
        comparableV1Output(record.compiledPublic),
      );
    }
  });

  test("2,000 seeded v1 inputs compile to the frozen published semantic digests", () => {
    expect(evidence.seed).toBe(oracleSeed);
    expect(evidence.caseCount).toBe(oracleCaseCount);
    const cases = randomizedV1Cases();
    expect(cases).toHaveLength(oracleCaseCount);
    expect(evidenceDigest(cases.map(({ input }) => input))).toBe(evidence.inputDigest);
    expect(evidence.randomizedOutputDigests).toHaveLength(oracleCaseCount);

    const layerCounts = [0, 0, 0];
    let multiMode = 0;
    let graphInternal = 0;
    let layerInternal = 0;
    let explicitVisibility = 0;
    let layerReferences = 0;
    let graphToLayerReferences = 0;
    cases.forEach(({ input }, index) => {
      layerCounts[input.layers.length] = (layerCounts[input.layers.length] ?? 0) + 1;
      multiMode += Number(input.modes.length > 1);
      graphInternal += Number(input.defaultVisibility === "internal");
      layerInternal += Number(input.layers.some((layer) => layer.defaultVisibility === "internal"));
      explicitVisibility += Number(
        input.layers.some((layer) => layer.tokens["shared.value"]?.visibility !== undefined),
      );
      layerReferences += Number(
        input.layers.some((layer) => {
          const value = layer.tokens["shared.value"]?.value;
          return typeof value === "object" && value !== null && "ref" in value;
        }),
      );
      graphToLayerReferences += Number(input.tokens["alias.layer"]?.value !== undefined);
      const result = compile(input, "all");
      expect(evidenceDigest(comparableV1Output(result.compiled))).toBe(
        evidence.randomizedOutputDigests[index],
      );
    });
    expect(layerCounts).toEqual([660, 693, 647]);
    expect(multiMode).toBe(1318);
    expect(graphInternal).toBe(998);
    expect(layerInternal).toBe(788);
    expect(explicitVisibility).toBe(848);
    expect(layerReferences).toBe(814);
    expect(graphToLayerReferences).toBe(1340);
  });
});
