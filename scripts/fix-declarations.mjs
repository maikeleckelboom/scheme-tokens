// @ts-nocheck
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
for (const file of listFiles(dist).filter((path) => path.endsWith(".d.ts"))) {
  const input = readFileSync(file, "utf8");
  const output = input
    .replace(/(from\s+["'])(\.[^"']*?)(["'])/g, rewriteSpecifier)
    .replace(/(import\(["'])(\.[^"']*?)(["']\))/g, rewriteSpecifier);
  if (output !== input) writeFileSync(file, output);
}

function rewriteSpecifier(_match, prefix, specifier, suffix) {
  return /\.[cm]?js$|\.json$/u.test(specifier)
    ? `${prefix}${specifier}${suffix}`
    : `${prefix}${specifier}.js${suffix}`;
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
