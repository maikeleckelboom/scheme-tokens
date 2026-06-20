# Color Policy

Core color values are concrete authored color data, not computed colors. Manual colors are a primary root-package
use case.

## Supported Core Spaces

- `srgb`
- `display-p3`
- `oklch`

The parser accepts supported CSS strings and plain JSON-safe color objects. It preserves finite authored coordinates,
including extended sRGB or Display-P3 coordinates. Core does not convert between color spaces and does not gamut-map.

High-gamut color is native token value capability, not a mode strategy. Do not model high gamut as fake modes such as
`light-p3` or `dark-p3`; real theme modes stay `light` and `dark`, and each token value may use `srgb`, `display-p3`, or
`oklch`.

## CSS Formatting

`formatCssColor()` preserves the stored color space:

- byte-aligned opaque sRGB can serialize as hex;
- other sRGB and Display-P3 values serialize with `color(...)`;
- OKLCH values serialize with `oklch(...)`.

Any conversion, gamut mapping, perceptual difference, contrast repair, or dynamic palette generation belongs in a future
adapter or optional package. Future Texel behavior belongs in `@scheme-tokens/conversion-texel`, using the upstream
engine package `@texel/color` inside that adapter package only. Core must remain free of `@texel/color`, and gamut
mapping must never be silent.
