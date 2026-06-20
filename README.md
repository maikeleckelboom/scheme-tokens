# color-scheme-tokens

Deterministic, JSON-first color token graphs for TypeScript and JavaScript applications.

The root package parses and compiles color-token graphs, resolves same-mode references, serializes canonical token sets,
and exports validated CSS custom properties. Color conversion and Material 3 generation are explicit subpath imports;
root workflows do not load either engine.

This repository is still private at version `0.0.0` while the first public contract is being finalized.

## Core Graph

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

const graph = defineTokenGraph({
  formatVersion: 1,
  modes: ["dark", "light"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      valueByMode: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
    "app.action": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues, null, 2));

const css = exportCssVariables(compiled.value, { variablePrefix: "theme" });
if (!css.ok) throw new Error(JSON.stringify(css.issues, null, 2));

console.log(css.value);
```

`defaultMode` controls the base CSS block. Other modes are emitted in canonical code-unit order. Token hierarchy maps to
CSS custom properties with `--` between token-key segments, for example `app.action` becomes `--app--action`.

## Fragments And Sources

```ts
import {
  buildTokenSet,
  defineTokenFragment,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "color-scheme-tokens";

interface CompanyIssue extends Issue<"missing-company-primary"> {}

function companySource(primary?: string): TokenSource<CompanyIssue> {
  const capturedPrimary = primary;
  return {
    id: "company",
    build(): Result<TokenGraphInput, CompanyIssue> {
      if (capturedPrimary === undefined) {
        return {
          ok: false,
          issues: [{ code: "missing-company-primary", message: "Primary color is required." }],
        };
      }
      return {
        ok: true,
        value: {
          formatVersion: 1,
          modes: ["light", "dark"],
          defaultMode: "light",
          defaultVisibility: "internal",
          tokens: {
            "company.primary": {
              valueByMode: {
                light: capturedPrimary,
                dark: "#b5c4ff",
              },
            },
          },
        },
      };
    },
  };
}

const application = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.action": {
      value: { ref: "company.primary" },
    },
  },
});

const built = buildTokenSet({
  source: companySource("#1455d9"),
  fragments: [application],
});

if (!built.ok) throw new Error(JSON.stringify(built.issues, null, 2));
```

Fragments never override. Duplicate token keys across a graph, source, or fragment are issues.

## Material 3

```ts
import { buildTokenSet, defineTokenFragment } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const app = defineTokenFragment({
  formatVersion: 1,
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.canvas": { value: { ref: "m3.surface" } },
    "app.text": { value: { ref: "m3.on-surface" } },
    "app.action": { value: { ref: "m3.primary" } },
  },
});

const built = buildTokenSet({
  source: material3Source({ sourceColor: "#6750a4" }),
  fragments: [app],
});

if (!built.ok) throw new Error(JSON.stringify(built.issues, null, 2));
```

Material roles are generated as internal `m3.*` tokens with a fixed lower-kebab inventory. Out-of-sRGB input is rejected
unless explicit gamut mapping is configured.

## Conversion

```ts
import { parseColor } from "color-scheme-tokens";
import { convertColor, isColorInGamut, mapColorToGamut } from "color-scheme-tokens/conversion";

const parsed = parseColor("color(display-p3 1 0.22 0.08)");
if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues, null, 2));

const converted = convertColor(parsed.value, "srgb");
if (!converted.ok) throw new Error(JSON.stringify(converted.issues, null, 2));

if (!isColorInGamut(converted.value, "srgb")) {
  const mapped = mapColorToGamut(converted.value, "srgb", { method: "preserve-lightness" });
  if (!mapped.ok) throw new Error(JSON.stringify(mapped.issues, null, 2));
}
```

Conversion does not clip or gamut-map. Mapping is a separate explicit lossy operation.

## Development

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

`release:check` builds the package, validates runtime/type surfaces, checks schemas and docs examples, runs package
linting, installs the packed tarball into a clean consumer, and checks tarball contents. The package remains
`private: true`; publishing, tagging, and release creation are separate owner-controlled steps.
