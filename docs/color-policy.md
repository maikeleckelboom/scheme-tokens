# Value Policy

The initial public value model is intentionally narrow: a token value is a string or an explicit token reference that eventually resolves to a string.

## Rules

- Bare strings are literal values.
- References use `tokenRef("token.key")` in trusted TypeScript and exact `{ ref: "token.key" }` records in persisted artifacts.
- The package preserves strings; it does not parse, normalize, convert, repair, or prove their meaning.
- Compilation and serialization accept and preserve arbitrary strings.
- CSS export does not reinterpret token meaning, but it does reject declaration-unsafe strings with `invalid-css-value` before emitting code.
- Structured design-token values are outside the current contract.
- External producers may compute strings before passing them to `scheme-tokens`, but their algorithms and policy remain outside this package.

The CSS check is an output-safety boundary, not a color or token-domain parser. The package name describes scheme compilation, not ownership of a color engine or a general design-system value model.
