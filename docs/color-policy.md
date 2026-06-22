# Value Policy

The root package treats token values as authored CSS-ready strings.

It does not parse, normalize, convert, gamut-map, or validate color syntax. That same rule also keeps spacing, typography, shadows, radii, and other CSS-variable-ready values in scope without adding domain engines.

## Rules

- Bare strings are literal token values.
- References are explicit objects, usually created with `tokenRef("token.key")`.
- Strict persisted references stay shaped as `{ ref: "token.key" }`.
- Compiled token values are strings.
- CSS export writes compiled strings as custom property values without reinterpretation.

External generators may produce strings before data reaches `scheme-tokens`. Those generators are outside the root package boundary.
