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
  return /(?:^|[\\/])docs[\\/]audit-\d{4}-\d{2}\.md$/u.test(path);
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
 * durable `docs/` and `docs-site/` trees, without dated reports or generated
 * VitePress output.
 */
export function listPublicMarkdownFiles(): readonly MarkdownFile[] {
  return [
    join(repoRoot, "README.md"),
    ...listFiles(join(repoRoot, "docs")),
    ...listFiles(join(repoRoot, "docs-site")),
  ]
    .filter(
      (path) =>
        path.endsWith(".md") && !isPointInTimeReport(path) && !isGeneratedDocsSiteFile(path),
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
