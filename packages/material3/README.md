# @scheme-tokens/material3

Material 3 dynamic scheme adapter for `scheme-tokens`.

Manual token graphs only need the root `scheme-tokens` package. Install this adapter when a project wants Material 3
Dynamic Color output backed by the official Material Color Utilities implementation.

```bash
pnpm add scheme-tokens @scheme-tokens/material3
```

## Usage

```ts
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  tokens: {
    background: "material3.surface",
    foreground: "material3.on-surface",
    primary: "material3.primary",
    "primary-foreground": "material3.on-primary",
  },
});

const built = buildScheme(material3("#6750a4"), { layers: [application] });

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const exported = exportCssVars(built.value);
if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

console.log(exported.value.css);
console.log(exported.value.blocks[0]?.declarations["--primary"]);
```

The adapter emits strict graph input with `light` and `dark` modes. Raw Material roles use adapter-owned `material3.*`
token keys and can be exported when selected:

```text
material3.primary
material3.on-primary
material3.primary-container
```

## Material Input

`sourceColors` is the canonical Material source-color field. `material3("#6750a4")` is shorthand for
`material3({ sourceColors: "#6750a4" })` and is the ordinary one-color path:

```ts
material3("#6750a4");
```

Use the object form when you want explicit Material generation input:

```ts
material3({
  sourceColors: "#6750a4",
});
```

`sourceColors` is required in the object form. It accepts a strict opaque `#rrggbb` string for the common
one-brand-color case, or an array for official multi-source generation paths. Empty arrays fail at runtime validation:

```ts
material3(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" });
```

The first color is the primary source color. Additional colors are passed to the official multi-source Material
generation path in array order; they are not silently reduced to the first color.

`material3(input, options?)` separates Material generation input from scheme-token integration policy. With object input,
the optional second argument owns integration policy:

```ts
material3(
  {
    sourceColors: "#6750a4",
  },
  {
    id: "brand-material",
    defaultVisibility: "internal",
  },
);
```

With shorthand input, the optional second argument owns Material generation options and the optional third argument owns
integration policy:

```ts
material3("#6750a4", { variant: "expressive" }, { defaultVisibility: "internal" });
```

`id` and `defaultVisibility` are integration options, not Material generation input. They are rejected in object input
and in the shorthand generation-options position.

Use `material3Preset()` when repeated builds share Material generation defaults or integration policy:

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" }, { defaultVisibility: "internal" });

const base = material("#6750a4");
```

Runtime generation input overrides preset defaults:

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" });

const expressiveBase = material("#6750a4", {
  variant: "expressive",
});

const cmfBase = material(["#6750a4", "#00a88f"], {
  variant: "cmf",
  specVersion: "2026",
});

const objectBase = material({
  sourceColors: "#6750a4",
  variant: "expressive",
});
```

Preset defaults do not include `sourceColors`; runtime calls provide source colors through shorthand or object input.
Arrays such as `extendedColors` replace preset arrays. Integration options are fixed at preset creation, so create a
separate preset or call `material3()` directly when `id` or `defaultVisibility` differs.

## Dynamic Controls

The adapter supports the official engine controls available in the vendored Material Color Utilities snapshot:

- `variant`: `monochrome`, `neutral`, `tonal-spot`, `vibrant`, `expressive`, `fidelity`, `content`, `rainbow`,
  `fruit-salad`, `cmf`;
- `contrastLevel`: finite number from `-1` through `1`, default `0`;
- `specVersion`: `2021`, `2025`, `2026`, default `2021`;
- `platform`: `phone`, `watch`, default `phone`.

The default variant is `tonal-spot`. CMF is official 2026 behavior, so `variant: "cmf"` requires
`specVersion: "2026"`. The official CMF path accepts one or more source colors; a second color influences multi-source
CMF output but is not required by the current official implementation.

```ts
material3({
  sourceColors: ["#6750a4", "#00a88f"],
  variant: "cmf",
  contrastLevel: 0.5,
  specVersion: "2026",
  platform: "phone",
});
```

## Palette Overrides

`palettes` overrides generated tonal palettes without changing Material role token keys:

```ts
material3({
  sourceColors: "#6750a4",
  palettes: {
    primary: "#6750a4",
    secondary: "#006a60",
    tertiary: "#7d5260",
    neutral: "#605d62",
    neutralVariant: "#605d66",
    error: "#ba1a1a",
  },
});
```

Palette override colors use the same strict `#rrggbb` validation and are converted through official Material tonal
palette utilities. Top-level `primary`, `secondary`, `tertiary`, `neutral`, `neutralVariant`, and `error` fields are not
source-color fallbacks.

## Extended Colors

Material extended colors are exposed through canonical scheme-tokens vocabulary:

```ts
material3({
  sourceColors: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      harmonize: true,
      description: "Positive state color",
    },
  ],
});
```

Each entry is shaped as `{ name, color, harmonize?, description? }`. `name` is a lower-kebab token segment, `color` uses
strict `#rrggbb`, and `harmonize` maps to Material custom color harmonization behavior. When omitted, `harmonize`
defaults to `true`. `description` is preserved as token metadata on the main extended color token.

Extended color tokens are emitted as adapter-owned keys:

```text
material3.extended.success.color
material3.extended.success.on-color
material3.extended.success.color-container
material3.extended.success.on-color-container
```

Extended color roles use the official custom color group behavior: harmonization and tonal-palette roles are based on the
extended color entry and primary source color. They are not claimed to respond to every dynamic scheme control when the
upstream custom color algorithm does not define that behavior.

## Optional Material Roles

Role tokens are emitted only when the selected official Material spec exposes the role for both light and dark schemes.
Newer roles such as `primary-dim`, `secondary-dim`, `tertiary-dim`, and `error-dim` can therefore differ by
`specVersion`. The adapter preserves that upstream surface instead of pretending every spec version has identical role
keys.

## Palette Tone Tokens

`paletteTones` is opt-in to avoid bloating the base graph.

```ts
material3({
  sourceColors: "#6750a4",
  paletteTones: [0, 40, 90, 100],
});
```

`paletteTones: true` emits the material-schemes tone list:

```text
0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100
```

Palette tone token keys are lower-kebab and core-schema compatible:

```text
material3.palette.primary.tone-40
material3.palette.secondary.tone-90
material3.palette.tertiary.tone-40
material3.palette.neutral.tone-98
material3.palette.neutral-variant.tone-90
material3.palette.error.tone-40
material3.extended.success.palette.tone-40
```

## Full Example

```ts
import { buildScheme, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const built = buildScheme(
  material3(
    {
      sourceColors: ["#6750a4", "#00a88f"],
      variant: "cmf",
      specVersion: "2026",
      contrastLevel: 0.5,
      extendedColors: [
        {
          name: "success",
          color: "#2e7d32",
          harmonize: true,
        },
      ],
    },
    {
      defaultVisibility: "internal",
    },
  ),
);

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const css = exportCssVars(built.value);
```

## Compatibility

The package is pre-release and intentionally does not keep compatibility spellings. Removed or older option names are
rejected instead of being treated as aliases.

Light and dark are graph modes in `scheme-tokens`, and layers are the extension point for project-owned modifications.

## Engine Provenance

The published npm package `@material/material-color-utilities@0.4.0` does not expose the latest official main-branch
surface required here, including the 2026 spec, CMF variant, CMF scheme, and official multi-source generation behavior.
This adapter therefore vendors a minimal official TypeScript snapshot from
`material-foundation/material-color-utilities@6fd88eb3e95ba1d457842e2a2bf847d06b3a018a`.

The vendored files live under `src/vendor/material-color-utilities`, keep their Apache-2.0 license headers, and are not
exported from `@scheme-tokens/material3`. See `NOTICE.md` for attribution details.

Material 3 support lives in this adapter package. The root package does not import, export, document as required, or
depend on the Material engine for manual token graphs.
