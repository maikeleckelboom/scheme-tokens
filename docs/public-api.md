# Public API

The [API reference](../docs-site/reference/api.md) describes the core `0.4.0` contract.
Start with the [README](../README.md) for a working graph and stylesheet.

## Runtime exports

| Task             | Exports                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| Author tokens    | `defineTokenGraph`, `defineTokenLayer`, `tokenRef`, `tokenConcat`       |
| Parse artifacts  | `parseTokenGraph`, `parseTokenLayer`, `parseCompiledScheme`             |
| Compile          | `compileTokenGraph`                                                     |
| Export CSS       | `exportCssVars`                                                         |
| Serialize        | `serializeTokenGraph`, `serializeTokenLayer`, `serializeCompiledScheme` |
| Throw on failure | `orThrow`                                                               |

## Find the contract you need

- [Authoring and expressions](../docs-site/reference/api.md#authoring): definition shapes, modes,
  key grammar, references, and concat.
- [Layers and visibility](../docs-site/reference/api.md#layers-and-visibility): ordering and overrides.
- [Compilation and metadata](../docs-site/reference/api.md#compilation-and-selection): selection,
  resolved values, `declarations`, `declaredVisibility`, and retained expressions.
- [Parsers and artifacts](../docs-site/reference/api.md#parsers): untrusted input, format version 2,
  v1 source upgrades, schemas, and serialization.
- [CSS reference](../docs-site/reference/css.md): activation, naming, `references: "var"`, output,
  and safety.
- [TypeScript access](../docs-site/guide/typescript-access.md): inference, complete and partial
  records, and generic types.
- [Diagnostics](./diagnostics.md): `Result`, `Issue`, codes, paths, and payloads.
- [Material reference](../docs-site/reference/material3.md): the optional `0.2.0` generator and
  its `^0.4.0` core peer.
