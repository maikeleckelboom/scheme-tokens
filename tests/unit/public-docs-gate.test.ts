import { describe, expect, test } from "vitest";
import {
  isContributorDocument,
  isDecisionRecord,
  isPointInTimeReport,
  listPublicMarkdownFiles,
} from "../../scripts/public-docs";

/**
 * The documentation gate is only as good as the file list it runs over, so the
 * exemptions are pinned here. Documentation drift shipped once because nothing
 * held docs to the export surface; a silently widening exemption would put the
 * gate back in that state.
 */
describe("public documentation gate scope", () => {
  test("covers the README and every durable docs tree", () => {
    const labels = listPublicMarkdownFiles().map((file) => file.label);

    expect(labels).toContain("README.md");
    expect(labels).toContain("docs/public-api.md");
    expect(labels).toContain("docs/architecture.md");
    expect(labels).toContain("docs/semver.md");
    expect(labels).toContain("docs-site/reference/api.md");
  });

  test("drops records but keeps the agent context document symbol-checked", () => {
    const labels = listPublicMarkdownFiles().map((file) => file.label);

    expect(labels).not.toContain("docs/audit-2026-08.md");
    expect(labels).not.toContain("docs/audit-2026-08-material3-adapter.md");
    expect(labels).not.toContain("docs/adr/0001-core-boundary.md");
    expect(labels).toContain("docs/agents-context.md");
  });

  test("holds every other document to the published surface", () => {
    expect(isContributorDocument("/repo/docs/public-api.md")).toBe(false);
    expect(isContributorDocument("/repo/docs/agents.md")).toBe(false);
    expect(isContributorDocument("/repo/docs/adr/0001-core-boundary.md")).toBe(false);
    expect(isContributorDocument("/repo/README.md")).toBe(false);
    expect(isContributorDocument("/repo/docs/agents-context.md")).toBe(true);
    expect(isContributorDocument("C:\\repo\\docs\\agents-context.md")).toBe(true);

    expect(isPointInTimeReport("/repo/docs/public-api.md")).toBe(false);
    expect(isPointInTimeReport("/repo/docs/audit.md")).toBe(false);
    expect(isPointInTimeReport("/repo/docs/audit-2026-08.md")).toBe(true);
    expect(isPointInTimeReport("/repo/docs/audit-2026-08-material3-adapter.md")).toBe(true);
    expect(isPointInTimeReport("C:\\repo\\docs\\audit-2026-08-material3-adapter.md")).toBe(true);
    expect(isPointInTimeReport("/repo/docs/audit-2026-08-Material3.md")).toBe(false);

    expect(isDecisionRecord("/repo/docs/public-api.md")).toBe(false);
    expect(isDecisionRecord("/repo/docs/adr.md")).toBe(false);
    expect(isDecisionRecord("/repo/docs/adr/0001-core-boundary.md")).toBe(true);
    expect(isDecisionRecord("C:\\repo\\docs\\adr\\0004-material3-adapter-design.md")).toBe(true);
  });
});
