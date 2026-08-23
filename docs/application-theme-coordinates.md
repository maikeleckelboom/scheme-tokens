# Application Theme Coordinates

Applications can have several independent theme axes even though `scheme-tokens` models one explicit
mode envelope. Keep the application concepts independent in runtime state, persistence, controls, and
URLs. Combine them only at the compiler boundary.

For example, an application can own `PaletteId` and `ResolvedScheme` while its build adapter privately
maps each coordinate to a complete compiler mode. Flattened names such as `mono-light` and `vivid-dark`
are compiler-boundary details, not a theme-coordinate abstraction that the library or application state
needs to expose.

Exact token selection makes the downstream semantic contract explicit. Exact selector maps can then
attach each private compiler mode to the application's compound selectors. When an application needs
another selector or an at-rule, reuse the exporter's structured declarations and compose that policy
outside the package.

## Executable reference

The checked-in
[theme-coordinate example](https://github.com/maikeleckelboom/scheme-tokens/tree/main/examples/theme-coordinates)
is the source that the packed release-consumer gate typechecks and executes. Its
[`theme.ts`](https://github.com/maikeleckelboom/scheme-tokens/blob/main/examples/theme-coordinates/theme.ts)
demonstrates:

- independent palette and resolved-scheme application types mapped to four complete compiler modes;
- exact literal mode and public-role types;
- public semantic roles that reference internal source tokens;
- exact-key selection that excludes those source tokens from compiled and CSS output;
- application-owned exact selectors and reuse of structured declaration blocks;
- deterministic compiled serialization, CSS, block, and variable-map output.

Run `pnpm check:theme-coordinate-consumer` from the repository root to pack the package, install that
tarball into a strict NodeNext consumer, then typecheck and execute the same checked-in source.

## Ownership boundary

The compiler receives four explicit, complete modes and returns only the selected public roles.
Internal source tokens remain available during reference resolution but are absent from the selected
compiled record and CSS output.

The application remains responsible for browser preference handling, theme state, persistence,
controls, URLs, selector precedence, and media-query policy. Color parsing, conversion, color-gamut
decisions, palette generation, and contrast policy also remain outside `scheme-tokens`; the graph stores
and preserves the strings the application supplies.
