# Architecture

`scheme-tokens` composes string-valued token graphs, resolves their references for each mode,
and produces selected values with declaration metadata. The compiled result can be serialized
or exported as CSS.

## Authoring and validation

```text
TypeScript authoring -> normalization --+
                                       |
v2 artifacts --------------------------+-> validation -> composition -> resolution -> selection
                                       |
v1 source -> validation -> upgrade -----+
```

Authoring helpers expand shorthand into the artifact grammar. Helpers and parsers then share
validation, composition, and resolution rules, so authoring syntax and persisted data describe
the same graph.

Helpers validate and copy input, throwing structured errors for misuse. They defer reference
target and cycle checks to compilation, where the final composition is available. Graph parsing
checks those relationships before accepting persisted input. Parsers report invalid
JSON-compatible data through `Result`.

## Composition

The graph defines the mode set, mode order, and `defaultMode`. Layers supply reusable token
declarations for that set.

Layers compose in array order, followed by graph-local tokens. The winning declaration supplies
the value and descriptive metadata. Visibility follows the declaration chain: an explicit value
replaces it, while an omitted override keeps the preceding effective visibility. A new key uses
its introducing position's default.

This lets generated source tokens remain internal while application aliases are public.
[Composition rules](../docs-site/reference/api.md#layers-and-visibility) specify the details.

## Resolution and selection

References resolve against all composed tokens for every mode before output selection.
Resolution is iterative and memoized, so deep graphs avoid recursive stack limits and shared
dependencies reuse resolved values.

Concat is normalized to flat parts, then resolved to a string with a 65,536 UTF-16 code-unit
limit. Reference paths retain their original locations through normalization and source upgrades.

Selection chooses public tokens by default, all tokens, or named keys. Compiled metadata records
the declaration chain and retains non-literal expressions for
[CSS reference projection](../docs-site/reference/css.md#reference-projection).
TypeScript inference follows the composition and selection rules; dynamic data keeps conservative
[partial records](../docs-site/guide/typescript-access.md#complete-and-partial-records).

## Persistence

Version 2 separates source graphs and layers from compiled schemes. Source v1 upgrades preserve
their published semantics before passing through v2 validation. Compiled v1 is rebuilt from source
because its metadata shape differs.

Serialization uses code-unit key ordering while retaining semantic mode and layer order.
Packaged schemas describe artifact structure; runtime validation also checks relationships such
as mode agreement and reference cycles. See [artifacts and schemas](../docs-site/reference/api.md#artifacts-and-schemas).

## CSS projection

```text
compiled scheme -> structural validation -> options and activations -> variable names
                   -> projected declarations and safety checks -> blocks -> CSS
```

The exporter works with the scheme's selected tokens. Resolved output uses their strings;
`references: "var"` uses retained expressions to link emitted direct targets. Both formats and
structured blocks share the same projected declaration values.

Activation blocks follow default, media, attribute, and selector tiers. Each block declares every
selected token and uses zero-specificity selectors, so source order controls generated-rule
precedence and application CSS can override it through the cascade.

Declaration safety is checked at this code-emission boundary. Compilation and serialization
preserve arbitrary token strings. The [CSS reference](../docs-site/reference/css.md) owns the
projection, activation, and grammar contracts.

## Material generation

`@scheme-tokens/material3` computes color strings and returns a layer. The graph composes it
through the same path as authored layers. Its mode settings map generation to graph modes;
the graph retains mode order and default authority. See the
[Material reference](../docs-site/reference/material3.md).
