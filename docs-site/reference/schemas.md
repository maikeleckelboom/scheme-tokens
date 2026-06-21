# Schema Reference

Schemas describe strict persisted artifacts. They are structural preflight contracts, not authoring-helper schemas.

## Published Schema Paths

Import or resolve these package subpaths:

```text
scheme-tokens/schemas/color-token-graph.v1.schema.json
scheme-tokens/schemas/color-token-layer.v1.schema.json
scheme-tokens/schemas/compiled-color-scheme.v1.schema.json
```

## Artifact Kinds

| Artifact              | `kind`                                |
| --------------------- | ------------------------------------- |
| Color token graph     | `scheme-tokens/color-token-graph`     |
| Color token layer     | `scheme-tokens/color-token-layer`     |
| Compiled color scheme | `scheme-tokens/compiled-color-scheme` |

All 0.1.0 artifacts use `formatVersion: 1`.

## Strict Colors

Persisted colors are structured:

```json
{
  "colorSpace": "srgb",
  "components": [0.403921568627451, 0.3137254901960784, 0.6431372549019608],
  "alpha": 1,
  "hex": "#6750a4"
}
```

Helper-only strings such as `"#6750a4"` are not strict persisted colors.

## Schema Versus Parser

Schemas check shape: required properties, artifact kind, format version, token-definition structure, and structured color
fields. Helper-only strings are rejected in persisted artifacts.

Parsers check semantics: default-mode membership, mode coverage, references, cycles, token key validity, and cross-field
constraints. Use both when loading untrusted persisted artifacts.

## Minimal Strict Graph

```json
{
  "kind": "scheme-tokens/color-token-graph",
  "formatVersion": 1,
  "modes": ["base"],
  "defaultMode": "base",
  "defaultVisibility": "public",
  "tokens": {
    "primary": {
      "value": {
        "colorSpace": "srgb",
        "components": [0.403921568627451, 0.3137254901960784, 0.6431372549019608],
        "alpha": 1,
        "hex": "#6750a4"
      }
    }
  }
}
```
