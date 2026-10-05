# Material 3 reference

`@scheme-tokens/material3@0.2.0` requires `scheme-tokens: ^0.4.0`. It exports the `material3`
function and these six types:

- `Material3TokenKey`
- `Material3ColorMode`
- `Material3SpecVersion`
- `Material3Variant`
- `Material3ModeSettings`
- `Material3Options`

Start with the [Material guide](../guide/material3.md) for graph composition and application aliases.

## Generated layer

The `material3` function takes a source color and optional settings. It returns a `TokenLayer`
with ID `material3`, 48 role keys, and a value for every configured mode. Default modes are
`light` and `dark`; default visibility is
`public`. The graph declares its own modes and `defaultMode` and composes the layer through
`layers: [material]`.

The layer's mode set must match the graph. A second Material layer in the same graph fails with
`duplicate-layer-id`, since both have the same ID. Override generated values with an authored
layer or graph-local declarations.

## Generation settings

| Setting         | Accepted value             | Default                 | Per-mode override |
| --------------- | -------------------------- | ----------------------- | ----------------- |
| `sourceColor`   | `#[0-9a-fA-F]{6}`          | Required first argument | Yes               |
| `variant`       | `Material3Variant`         | `tonal-spot`            | Yes               |
| `contrastLevel` | Finite number in `[-1, 1]` | `0`                     | Yes               |
| `specVersion`   | `"2021"` or `"2025"`       | `"2021"`                | No                |
| `visibility`    | `"public"` or `"internal"` | `"public"`              | No                |

The 2021 spec supports `monochrome`, `neutral`, `tonal-spot`, `vibrant`, `expressive`, `fidelity`,
`content`, `rainbow`, and `fruit-salad`. The 2025 spec supports `neutral`, `tonal-spot`, `vibrant`,
and `expressive`. Unsupported effective spec/variant combinations are rejected rather than
using the engine's fallback.

Generation uses Material's phone platform. Source colors normalize to lowercase; output values
are lowercase six-digit hex strings. The package bundles Material Color Utilities `0.4.0`.

## Mode settings

`modeSettings` is a non-empty map from graph mode names to generation settings. Omission uses
`{ light: {}, dark: {} }`; a supplied map replaces that set completely, including for a single mode.

| Mode name                  | `colorMode`                    |
| -------------------------- | ------------------------------ |
| `light`                    | Omitted or `"light"`           |
| `dark`                     | Omitted or `"dark"`            |
| Any other valid graph mode | Required `"light"` or `"dark"` |

Each entry may also set `sourceColor`, `variant`, and `contrastLevel`. Omitted fields inherit
their global values independently. `specVersion` and `visibility` apply to the whole layer.
The positional argument supplies the global source color; top-level `sourceColor` is rejected.

All effective mode settings are checked before generation. A global variant overridden in every
mode still needs to be a valid variant name, but only the effective variants must support the
selected spec. Mode names use the core grammar, including its reserved names.

## TypeScript

`Material3Options<Mode, Visibility>` defaults `Mode` to `Material3ColorMode` and `Visibility` to
`TokenVisibility`. The function defaults to the light/dark pair and public visibility.

Inline options preserve literal modes and visibility. `satisfies Material3Options` checks an
object while retaining its literals; a variable annotated only as `Material3Options` leaves
visibility uncertain. Public compilation then stays partial over every composed key, including
possibly public Material roles.

The options type requires the settings behind non-default claims:

- Any mode set other than exactly `"light" | "dark"` requires `modeSettings`, including a single
  built-in mode.
- A visibility type that excludes `"public"` requires `visibility`.
- `Material3Options<"custom", "internal">` requires both fields.

The non-generic default overload accepts omitted or `undefined` options. Explicit generic calls
require an options object. Narrow possibly undefined options or supply a valid fallback.
For `Material3Options | undefined`, an empty object fallback uses the default mode pair.
A custom mode type needs its own map fallback or a separate default-call branch.

### Generic wrappers

```ts
import { material3, type Material3Options } from "@scheme-tokens/material3";
import type { TokenVisibility } from "scheme-tokens";

function generate<Mode extends string, Visibility extends TokenVisibility>(
  source: string,
  options: Material3Options<Mode, Visibility>,
) {
  return material3(source, options);
}

const settings = {
  modeSettings: { custom: { colorMode: "light" } },
  visibility: "internal",
} satisfies Material3Options<"custom", "internal">;

const custom = generate("#6750a4", settings);
```

`Material3ModeSettings<Mode>[M]` names one mode's settings. Its map requires every mode in `Mode`
and rejects an empty mode set.

### Return type

```ts
import type { Material3TokenKey } from "@scheme-tokens/material3";
import type { TokenLayer, TokenVisibility } from "scheme-tokens";

type MaterialLayer<Mode extends string, Visibility extends TokenVisibility> = TokenLayer<
  Material3TokenKey,
  NoInfer<Mode>,
  {
    readonly defaultVisibility: NoInfer<Visibility>;
    readonly mayStatePublicKeys: never;
    readonly mayStateInternalKeys: never;
    readonly mayOmitVisibilityKeys: Material3TokenKey;
  }
>;
```

Generated declarations omit per-role visibility and use the layer default. `NoInfer` keeps return
annotations from supplying modes or visibility that the call's settings did not establish.
Core selection and completeness rules apply to the resulting layer; see
[TypeScript access](../guide/typescript-access.md).

## Role catalog

All keys begin with `md.sys.color.`. These suffixes make up `Material3TokenKey`:

| Group               | Suffixes                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Background          | `background`, `on-background`                                                                                                   |
| Surface             | `surface`, `surface-dim`, `surface-bright`, `on-surface`, `surface-variant`, `on-surface-variant`                               |
| Containers          | `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest` |
| Inverse             | `inverse-surface`, `inverse-on-surface`, `inverse-primary`                                                                      |
| Outline and effects | `outline`, `outline-variant`, `shadow`, `scrim`                                                                                 |
| Primary             | `primary`, `on-primary`, `primary-container`, `on-primary-container`                                                            |
| Secondary           | `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container`                                                    |
| Tertiary            | `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container`                                                        |
| Error               | `error`, `on-error`, `error-container`, `on-error-container`                                                                    |
| Primary fixed       | `primary-fixed`, `primary-fixed-dim`, `on-primary-fixed`, `on-primary-fixed-variant`                                            |
| Secondary fixed     | `secondary-fixed`, `secondary-fixed-dim`, `on-secondary-fixed`, `on-secondary-fixed-variant`                                    |
| Tertiary fixed      | `tertiary-fixed`, `tertiary-fixed-dim`, `on-tertiary-fixed`, `on-tertiary-fixed-variant`                                        |

## Errors

Malformed plain-data inputs, missing custom `colorMode`, empty maps, and wrong source or contrast
types throw `TypeError`. Unsupported settings, unknown options, invalid source notation, and
out-of-range contrast throw `RangeError`.

Core mode-name failures propagate as structured `Error` with the issues tuple in `cause`.
The helper validates and copies input before returning a layer.
