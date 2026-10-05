# TypeScript access

The supported compiler range is
`>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.

## Read inferred tokens

Helpers preserve literal keys, modes, and visibility:

```ts
import { compileTokenGraph, defineTokenGraph, orThrow, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    source: { value: { light: "#6750a4", dark: "#d0bcff" }, visibility: "internal" },
    background: { light: "#ffffff", dark: "#111111" },
    primary: tokenRef("source"),
  },
});

const scheme = orThrow(compileTokenGraph(graph));
scheme.tokens.primary.dark.toUpperCase();

const everything = orThrow(compileTokenGraph(graph, { selection: "all" }));
everything.tokens.source.light.toUpperCase();
```

The public result contains `background` and `primary`; both are definite keys. The `all` result
also contains `source`.

## Complete and partial records

A complete record guarantees each selected key after successful compilation. A partial record
requires a presence check.

| Selection             | Complete when                                                    |
| --------------------- | ---------------------------------------------------------------- |
| Omitted or `"public"` | All composed keys and visibility declarations are known literals |
| `"all"`               | The composed key union is finite                                 |
| A key tuple           | The tuple contains finite literal keys                           |
| A runtime key array   | Remains partial                                                  |

Public output stays partial over every graph key if keys or visibility are uncertain. Examples
include `Record<string, …>`, `Object.fromEntries`, parsed graphs or layers, a layer list that is
not a tuple, and a layer annotated only as `TokenLayer<Key>`.

Use a literal key tuple when dynamic input must provide a specific output contract:

```ts
import { compileTokenGraph, orThrow, parseTokenGraph } from "scheme-tokens";

declare const input: unknown;
const graph = orThrow(parseTokenGraph(input));
const scheme = orThrow(compileTokenGraph(graph, { selection: ["primary"] }));
scheme.tokens.primary[scheme.defaultMode].toUpperCase();
```

Compilation validates that `primary` exists before returning it. This selection guarantees the
key; parsed mode names remain dynamic.

`CompiledScheme<Key, Mode, Complete>` represents completeness for both `tokens` and
`metadataByToken`. `parseCompiledScheme()` always returns the incomplete form.
`CssVarsExport<Key, Mode, Complete>` carries it into `variableByToken`. Prefer inference unless
an integration boundary needs an annotation.

## Graph and layer types

`defineTokenGraph()` returns `DefinedTokenGraph<Key, Mode, PublicKey, OwnKey>`:

- `Key` is every composed key.
- `Mode` is the mode union.
- `PublicKey` is the effective public key union after composition.
- `OwnKey` is the graph's own authored key union.

Own keys are definite in `graph.tokens`; a key supplied only by a layer is not promised there.
The mode union describes membership, while the runtime array retains order and `defaultMode`.

`defineTokenLayer()` infers `TokenLayer<Key, Mode, Visibility>`. Layer `Mode` is `never` for
direct expressions, a finite union for literal mode maps, and `string` when unknown. Every map
in a layer must name the whole set. A finite layer set must equal a finite graph set, in any
order; dynamic sets rely on runtime validation.

`Visibility` is a `LayerVisibilityFacts` type with `defaultVisibility`, `mayStatePublicKeys`,
`mayStateInternalKeys`, and `mayOmitVisibilityKeys`. These sets describe possible declarations,
not effective visibility, and may overlap. Wider types retain more possibilities.

## Keep inferred facts attached to authored values

Precise graph and layer types are nominal: they come from the helpers and values passed unchanged
from them. Raw objects, spread copies, and mapped types such as `Readonly<…>` are treated as
dynamic data. A finite key union is an exact claim; annotations cannot add or hide keys.
Compiling a union of graphs keeps a separate scheme type for each graph.

Assertions and mutations escape that guarantee. For example,
`Object.assign({}, graph, { defaultVisibility: "internal" })` keeps the original graph type,
although visibility changed. In-place mutation does the same. Define a changed graph or layer
with the helpers so inference reflects the new data.

## Understand authoring errors

For literal input, helpers reject errors at the affected property:

| Input problem                                | Diagnostic                                  |
| -------------------------------------------- | ------------------------------------------- |
| A direct graph reference to an unknown key   | TypeScript key suggestions                  |
| Missing or undeclared mode values            | Missing property or `UnknownMode<Name>`     |
| Mixed or misspelled metadata                 | `UnknownTokenProperty<Name>`                |
| Invalid or reserved mode names               | `InvalidModeName<Name>`                     |
| A layer mode set that differs from the graph | `LayerModeMismatch<LayerModes, GraphModes>` |

They also reject invalid visibility, disagreeing layer maps, missing `defaultMode` for supplied
`modes`, and defaults outside the mode set. Reusable layers can reference another layer or
graph-local keys; compilation checks those targets.

Diagnostic marker names explain rejections and are not exported. Their wording is not a
compatibility contract. See [runtime diagnostics](../reference/diagnostics.md) for issue codes,
and [Material's TypeScript reference](../reference/material3.md#typescript) for generated layers.
