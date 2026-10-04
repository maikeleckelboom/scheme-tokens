import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Measures the static contract's check cost on a generated 2,000-token literal graph (ADR 0013
// D4/Appendix A). It reports evidence; it is deliberately not a threshold gate.
// Usage: pnpm profile:types [runs] [declaration file]

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runs = Number(process.argv[2] ?? "7");
const declaration = resolve(process.argv[3] ?? join(repoRoot, "dist", "index.d.ts"));
const compiler =
  process.env.SCHEME_TOKENS_TSC_PATH ?? join(repoRoot, "node_modules", "typescript", "bin", "tsc");
const tokenCount = 2000;
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error("runs must be a positive integer");
}

const root = mkdtempSync(join(tmpdir(), "scheme-tokens-profile-"));
try {
  const packageRoot = join(root, "node_modules", "scheme-tokens");
  mkdirSync(join(packageRoot, "dist"), { recursive: true });
  copyFileSync(declaration, join(packageRoot, "dist", "index.d.ts"));
  writeFileSync(join(packageRoot, "dist", "index.js"), "export {};\n");
  writeJson(join(packageRoot, "package.json"), {
    name: "scheme-tokens",
    type: "module",
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
  });
  writeJson(join(root, "package.json"), { private: true, type: "module" });
  writeJson(join(root, "tsconfig.json"), {
    compilerOptions: {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      module: "NodeNext",
      moduleResolution: "NodeNext",
      target: "ES2022",
      lib: ["ES2022"],
      types: [],
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["graph.ts"],
  });
  writeFileSync(join(root, "graph.ts"), generateGraph());

  const checks: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const output = execFileSync(
      process.execPath,
      [compiler, "-p", "tsconfig.json", "--extendedDiagnostics"],
      { cwd: root, encoding: "utf8" },
    );
    checks.push(Number(/Check time:\s+([\d.]+)s/u.exec(output)?.[1]));
  }
  const sorted = [...checks].sort((left, right) => left - right);
  const version = execFileSync(process.execPath, [compiler, "--version"], {
    encoding: "utf8",
  }).trim();
  process.stdout.write(
    `${version}; ${tokenCount} literal tokens; ${runs} runs; check time median ` +
      `${seconds(sorted[Math.floor(sorted.length / 2)])}, range ${seconds(sorted[0])}–` +
      `${seconds(sorted.at(-1))}\n`,
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

/** Two modes and every token shape: literals, maps, references, definitions and concat. */
function generateGraph(): string {
  const key = (index: number) => `group-${Math.floor(index / 100)}.token-${index % 100}`;
  const hex = (index: number) =>
    `#${((index * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}`;
  const lines: string[] = [];
  for (let index = 0; index < tokenCount; index += 1) {
    const target = key(Math.max(0, index - 1 - (index % 7)));
    const shapes = [
      `{ value: { light: "${hex(index)}", dark: "${hex(index + 1)}" }, visibility: "internal" }`,
      `{ light: "${hex(index)}", dark: "${hex(index + 2)}" }`,
      `tokenRef("${target}")`,
      `{ light: tokenRef("${target}"), dark: tokenRef("${key(index - 2)}") }`,
      `"${hex(index)}"`,
      `{ value: tokenRef("${target}"), description: "role ${index}" }`,
      `tokenConcat\`0 0 0 3px \${tokenRef("${target}")}\``,
      `{ value: { light: "${hex(index)}", dark: tokenRef("${target}") }, visibility: "public" }`,
    ];
    lines.push(`    "${key(index)}": ${shapes[index < 8 ? 0 : index % 8]},`);
  }
  return `import { compileTokenGraph, defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

export const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
${lines.join("\n")}
  },
});
export const publicScheme = compileTokenGraph(graph);
export const allScheme = compileTokenGraph(graph, { selection: "all" });
export const exactScheme = compileTokenGraph(graph, { selection: ["${key(1)}", "${key(2)}"] });
`;
}

function seconds(value: number | undefined): string {
  return `${(value ?? Number.NaN).toFixed(3)} s`;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
