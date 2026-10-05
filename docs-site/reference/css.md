# CSS reference

`exportCssVars(scheme, options?)` exports a compiled scheme. Start with the
[CSS guide](../guide/export-css-variables.md) for usage examples.

## Options

| Option         | Accepted value                                 | Default                 |
| -------------- | ---------------------------------------------- | ----------------------- |
| `prefix`       | A lower-kebab segment, such as `app`           | Omitted                 |
| `variableName` | A naming callback                              | Default name encoder    |
| `format`       | `"pretty"` or `"compact"`                      | `"pretty"`              |
| `references`   | `"resolved"` or `"var"`                        | `"resolved"`            |
| `activation`   | Root, media, attribute, and selector settings  | Default mode at `:root` |
| `cascadeLayer` | A layer name, such as `tokens` or `app.tokens` | Unlayered output        |

The exporter uses the scheme's selected tokens. It does not select tokens or add dependencies.
`activation.media` and `activation.selectors` are partial maps keyed by the scheme's modes.
Unknown modes return `unknown-condition-mode`.

## Activation

| Tier        | Option                                      | Target                                    |
| ----------- | ------------------------------------------- | ----------------------------------------- |
| `default`   | `activation.root`, default `:root`          | Default mode at the root selector         |
| `media`     | `activation.media: { mode: condition }`     | Mode at the root selector inside `@media` |
| `attribute` | `activation.attribute`                      | One `data-*` marker per mode              |
| `selector`  | `activation.selectors: { mode: condition }` | Custom selectors, optionally inside media |

Blocks follow tier order, then authored mode order, then a mode's condition order. The default
mode need not be first in the graph's mode list. Every block declares every selected token in
code-unit key order, including aliases and values shared across modes.

Every generated selector is wrapped in `:where()`, including custom selectors and `:host`.
Generated rules have zero specificity and normal importance. When multiple generated blocks
match the same element, the later one wins.

### Attribute markers

Omitting `activation.attribute` emits no markers. Its string form, such as `"data-theme"`, targets
ordinary elements with `[data-theme="<mode>"]`. The object form accepts `name` and an optional
boolean `includeHost`. With `includeHost: true`, a block also matches
`:host([data-theme="<mode>"])`.

Markers include the default mode and match on any element, so nested sections can switch back to
it. Unknown values match no block. `activation.root` controls default and media rules independently
of attribute targeting.

### Selector conditions

Each selector entry accepts:

- a selector string;
- one `CssCondition` object, `{ selector, media? }`;
- a non-empty list of `CssCondition` objects, in condition order.

```ts
import type { ExportCssVarsOptions } from "scheme-tokens";

const options = {
  activation: {
    selectors: {
      dark: ".dark",
      dim: [
        { selector: ".dim" },
        { selector: ".dark:not(.high-contrast)", media: "(prefers-contrast: less)" },
      ],
    },
  },
} satisfies ExportCssVarsOptions<string, "light" | "dark" | "dim">;
```

Conditions may overlap. Later modes win when conditions from different modes match one element.
Use disjoint selectors or order modes from general to specific when precedence matters.

## Application cascade

Within the same cascade layer, an application rule with specificity overrides generated rules
regardless of stylesheet order. Zero-specificity application rules compete by order.

`cascadeLayer` wraps the whole stylesheet, including media blocks, in `@layer <name>`. For normal
declarations, unlayered rules beat layered rules, and later layers beat earlier ones. Importance
reverses layer precedence.

The exporter emits custom properties. Bind a token such as `color-scheme` in application CSS
wherever themes activate; a root-only binding inherits the root's computed value into nested
themes. See the [guide](../guide/export-css-variables.md#let-application-css-override-tokens).

## Reference projection

Omission, explicit `undefined`, and `references: "resolved"` emit resolved strings.
`references: "var"` projects `metadataByToken[key].expressionByMode[mode]`:

| Retained expression                   | Emitted value                           |
| ------------------------------------- | --------------------------------------- |
| No entry for the mode                 | The token's resolved string             |
| `{ ref }`, target emitted             | `var(<target variable name>)`           |
| `{ ref }`, target omitted             | The referencing token's resolved string |
| Concat literal part                   | The literal text                        |
| Concat reference part, target emitted | `var(<target variable name>)`           |
| Concat reference part, target omitted | The part's retained `value`             |

Emitted membership determines linking, regardless of visibility. A selected internal target can
link; an omitted public target cannot. In a chain A → B → C, omitting B inlines A rather than
linking it to C. A variable declared elsewhere in application CSS does not make a target eligible.

Links use the actual names from `variableByToken`, including prefix and callback results. Naming
failures fail export rather than changing eligible links to literals. Literal text is preserved;
the exporter adds neither separators nor `var()` fallback arguments. Authored `var(...)` strings
remain literal token values.

### Where links stay live

Every activation block redeclares aliases. A target override on the same element propagates
through its local aliases and linked concat parts. This includes unlayered target overrides of
layered tokens in either stylesheet order. Inlined parts stay fixed.

An unmarked descendant inherits already-computed aliases. Overriding only the target there does
not update an inherited alias; redeclare the alias or activate a mode block on that element.

### Concat and CSS substitution

Core concat joins characters; CSS `var()` substitutes token streams:

- `calc(var(--spacing) * 2)` can stay live as a width or padding value.
- With `--number: 20`, `var(--number)px` is not `20px`; the number and unit remain separate tokens.
- Inside a quoted CSS string, inserted `var(--number)` remains literal text.

Use resolved output for arbitrary character assembly. Projection preserves the authored parts
and leaves their CSS interpretation to the browser.

## Names

Default names join token-key segments with single hyphens. `action.primary` becomes
`--action-primary`, or `--app-action-primary` with `prefix: "app"`.

Keys such as `a-b.c` and `a.b-c` share `--a-b-c`. A collision among exported names returns
`duplicate-css-variable` with `firstKey`, `key`, and `property`. `firstKey` is first in code-unit
order.

`variableName` receives `{ tokenKey, segments, defaultName, prefix? }`, with a non-empty segment
list and the prefix when supplied. It runs once per selected key in code-unit order. Both
declarations and references reuse its result. Custom names must match `^--[a-z][a-z0-9-]*$`.
A thrown callback or unsafe result returns
`invalid-css-variable`; collisions use the same check as default names.

## Result and formatting

The successful `value` contains:

| Field             | Contents                                                       |
| ----------------- | -------------------------------------------------------------- |
| `css`             | The formatted stylesheet                                       |
| `blocks`          | Ordered `CssVarBlock` records                                  |
| `variableByToken` | Token-to-variable lookup, with the input scheme's completeness |

Each block has `tier`, `mode`, non-empty `selectors`, optional `media`, and `declarations` of
`{ tokenKey, property, value }`. Declaration values are the complete strings emitted in CSS.
Blocks describe rules and declarations; formatting and the cascade-layer wrapper are represented
by `css`.

Pretty output uses indentation, blank lines between blocks, and a trailing newline. Compact
output omits formatting whitespace and the trailing newline.

## Safe emission

Compilation and serialization preserve arbitrary token strings. CSS export checks declaration
safety and returns `invalid-css-value` for unsafe emitted values. It rejects control characters,
comments, unbalanced quotes or delimiters, and declaration-breaking characters or `!important`
outside quotes. These checks concern emission syntax, not the meaning of a color or other value.

The compiled artifact is structurally parsed before options. With valid options, the exporter
checks each complete emitted value once per key/mode. Only modes with an activation block undergo
value checks. In `"var"` output, unused resolved values, unused retained fallbacks, and individual
concat fragments are not checked; each emitted target's own declaration is checked.

Resolved values and direct inlining use `/tokens/<key>/<mode>` issue paths. Unsafe retained concat
uses `/metadataByToken/<key>/expressionByMode/<mode>`. Naming failures and independent unsafe
values are collected together; invalid names are kept out of values used for safety diagnostics.

The CSS string is not HTML-escaped. Assign untrusted stylesheet text through the DOM, such as a
style element's `textContent`, rather than interpolating it into HTML where `</style>` can close
the element. Declaration safety does not validate arbitrary CSS semantics.

## Supported condition grammars

- **Selectors:** type, universal, class, ID, and attribute selectors; `:root`, `:host`,
  `:host(<compound>)`, and `:is()`, `:not()`, or `:where()` over selector lists; combinators and
  commas. Maximum 256 characters and eight nested functional pseudo-classes.
- **Media:** `all`, `print`, or `screen`, optionally prefixed by `not` or `only` and followed by
  `and` conditions; or parenthesized features joined by `not`, `and`, or `or`. Features include
  `(name)`, `(name: value)`, and ranges such as `(width >= 48rem)`. Keywords, names, and units are
  lowercase. Query lists with commas are rejected. Maximum 256 characters and eight nested
  parentheses.
- **Cascade layers:** dot-separated lower-kebab segments, excluding `inherit`, `initial`,
  `revert`, `revert-layer`, and `unset`. Maximum 128 characters.

Input outside these grammars returns an issue. See [Diagnostics](./diagnostics.md#css-export)
for codes and payloads.
