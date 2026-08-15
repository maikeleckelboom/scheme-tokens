import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface MarkdownFile {
  readonly label: string;
  readonly path: string;
  readonly text: string;
}

export const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Dated audit reports record the package as it was at one commit, so they name
 * symbols that were removed on purpose. They are excluded from the gates that
 * hold durable documentation to the current export surface.
 */
export function isPointInTimeReport(path: string): boolean {
  return /(?:^|[\\/])docs[\\/]audit-\d{4}-\d{2}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\.md$/u.test(path);
}

/**
 * The agent context document explains the release gates themselves, so it has
 * to be able to name the identifiers those gates forbid. It stays subject to
 * the documented-symbol check: naming a banned identifier in prose is allowed,
 * presenting one as package API is not. The pattern is pinned to that one file
 * so the exemption cannot widen to published documentation.
 */
export function isContributorDocument(path: string): boolean {
  return /(?:^|[\\/])docs[\\/]agents-context\.md$/u.test(path);
}

/**
 * An ADR records one decision at the moment it was taken. Doing that job means
 * quoting internal symbols, rejected shapes, and adapter packages that are
 * deliberately outside the boundary, so holding the series to today's export
 * surface would force rewriting decision history to keep a gate quiet. Decision
 * records are excluded instead; a decision that changes the contract still has
 * to land in the durable documentation the gates do cover.
 */
export function isDecisionRecord(path: string): boolean {
  return /(?:^|[\\/])docs[\\/]adr[\\/][^\\/]+\.md$/u.test(path);
}

export function isGeneratedDocsSiteFile(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return (
    normalized.includes("/docs-site/.vitepress/cache/") ||
    normalized.includes("/docs-site/.vitepress/dist/")
  );
}

/**
 * Every markdown file that documents the published package: the README plus the
 * durable `docs/` and `docs-site/` trees, without records, dated reports, or
 * generated VitePress output.
 */
export function listPublicMarkdownFiles(): readonly MarkdownFile[] {
  return [
    join(repoRoot, "README.md"),
    ...listFiles(join(repoRoot, "docs")),
    ...listFiles(join(repoRoot, "docs-site")),
  ]
    .filter(
      (path) =>
        path.endsWith(".md") &&
        !isPointInTimeReport(path) &&
        !isDecisionRecord(path) &&
        !isGeneratedDocsSiteFile(path),
    )
    .map((path) => ({
      label: path.slice(repoRoot.length + 1).replaceAll("\\", "/"),
      path,
      text: readFileSync(path, "utf8"),
    }));
}

export function listFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules") {
      return [];
    }
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
