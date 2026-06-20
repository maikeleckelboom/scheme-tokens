# Color Policy

Core color values are concrete authored color data, not computed colors. Manual custom colors are a primary root-package
use case.

## Supported Core Spaces

- `srgb`
- `display-p3`
- `oklch`

The parser accepts supported CSS strings and plain JSON-safe color objects. It preserves finite authored coordinates,
including extended sRGB or Display-P3 coordinates. Core does not convert between color spaces and does not gamut-map.

## CSS Formatting

`formatCssColor()` preserves the stored color space:

- byte-aligned opaque sRGB can serialize as hex;
- other sRGB and Display-P3 values serialize with `color(...)`;
- OKLCH values serialize with `oklch(...)`.

Any conversion, gamut mapping, perceptual difference, contrast repair, or dynamic palette generation belongs in a future
adapter or optional package.
