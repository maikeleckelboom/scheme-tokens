# Public API

The root API is intentionally small.

## Runtime Exports

- `defineTokenGraph`
- `defineTokenFragment`
- `parseTokenGraph`
- `parseColor`
- `compileTokenGraph`
- `buildTokenSet`
- `exportCssVariables`
- `serializeTokenSet`
- `formatCssColor`

## Package Subpaths

The package exports only:

- `.`
- `./schemas/token-graph.v1.schema.json`
- `./schemas/token-fragment.v1.schema.json`
- `./schemas/compiled-token-set.v1.schema.json`
- `./package.json`

There are no core conversion or Material subpaths.

## Authoring Helpers

`defineTokenGraph()` and `defineTokenFragment()` are ergonomic authoring helpers. They default `formatVersion` to `1` and
`defaultVisibility` to `public`. `defineTokenGraph()` also supports single-mode shorthand by defaulting to one `base`
mode when `modes` is omitted.

Token shorthands are normalized by the helpers:

- `"token.key": "#ffffff"` becomes `{ value: "#ffffff" }`;
- `"token.key": { ref: "other.token" }` becomes `{ value: { ref: "other.token" } }`;
- mode records such as `{ light: "#fff", dark: "#000" }` become `valueByMode` when modes are declared.

Declared mode names must not be token-definition keys such as `value`, `valueByMode`, `visibility`, `description`,
`deprecated`, or `extensions`. Those names are reserved so helper shorthand detection does not silently reinterpret
token definitions.

Strict parsing still requires the explicit wire-format shape.

## Adapter Sources

`TokenSource` is structural. Core accepts a safe source object with a valid string `id` and callable `build`, permits
extra adapter metadata, and invokes `build()` with the original source object as `this`.
