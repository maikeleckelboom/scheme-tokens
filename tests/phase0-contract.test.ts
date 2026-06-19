import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Phase 0 contract decisions", () => {
  it("records the required Phase 0 decisions", async () => {
    const adr = await readFile("docs/adr/0001-phase-0-contract-decisions.md", "utf8");

    expect(adr).toContain("v1 keeps Model A");
    expect(adr).toContain("Plural mounted sources are deferred");
    expect(adr).toContain("v1 keeps Option A");
    expect(adr).toContain("The recipe does not expose a public graph transform hook for v1");
    expect(adr).toContain("DTCG is exporter/importer interop only");
    expect(adr).toContain(
      "Material 3 stays behind the `color-scheme-tokens/sources/material3` subpath",
    );
    expect(adr).toContain("`serializeTokenSet()` is the canonical internal snapshot format");
  });

  it("keeps remaining graph blockers explicit without treating deferred work as Phase 0", async () => {
    const plan = await readFile("docs/phase-0-execution-plan.md", "utf8");

    expect(plan).toContain("Slice 1: expression references");
    expect(plan).toContain("Slice 2: explicit default mode");
    expect(plan).toContain("Slice 3: visibility and selection");
    expect(plan).toContain("References are graph expressions, not separate alias semantics");
    expect(plan).toContain("DTCG export/import");
    expect(plan).toContain("are outside Phase 0");
  });
});
