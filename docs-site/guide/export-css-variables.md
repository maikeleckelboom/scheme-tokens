# Export CSS Variables

`exportCssVars()` accepts a compiled scheme and returns a `Result` containing CSS, structured blocks, and a token-to-property lookup.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { light: "#ffffff", dark: "#111111" } },
});
const scheme = orThrow(compileTokenGraph(graph));

const cssVars = orThrow(
  exportCssVars(scheme, {
    activation: { attribute: "data-theme", media: { dark: "(prefers-color-scheme: dark)" } },
    prefix: "color",
  }),
);

const css = cssVars.css;
const blocks = cssVars.blocks;
const backgroundProperty = cssVars.variableByToken.background;
backgroundProperty.toUpperCase();
```

The emitted CSS:

```css
:where(:root) {
  --color-background: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --color-background: #111111;
  }
}

:where([data-theme="light"]) {
  --color-background: #ffffff;
}

:where([data-theme="dark"]) {
  --color-background: #111111;
}
```

`backgroundProperty` is a `string` because the literal graph's public keys are known, so the default public result is complete. The lookup mirrors the compiled record: it stays partial when the public set is uncertain or dynamic, and CSS exported from `parseCompiledScheme()` remains partial.

## Reference output

`references` accepts `"resolved"` (the default, also used for omission or explicit `undefined`) or `"var"`. Resolved output retains the compiled strings and the existing pretty/compact CSS exactly. Invalid values return `invalid-css-options` with `option: "references"` alongside other option failures.

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  tokenConcat,
  tokenRef,
} from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    spacing: "20px",
    extra: { value: "3px", visibility: "internal" },
    gap: tokenRef("spacing"),
    width: tokenConcat`calc(${tokenRef("spacing")} + ${tokenRef("extra")})`,
  },
});
const scheme = orThrow(compileTokenGraph(graph));
const linked = orThrow(exportCssVars(scheme, { references: "var", prefix: "app" }));
const fixed = orThrow(exportCssVars(scheme, { references: "resolved", prefix: "app" }));
```

The linked default block contains:

```css
:where(:root) {
  --app-gap: var(--app-spacing);
  --app-spacing: 20px;
  --app-width: calc(var(--app-spacing) + 3px);
}
```

For each emitted token/mode, only its sparse `metadataByToken[key].expressionByMode[mode]` governs projection. A mode with no retained expression uses its resolved string unchanged. A pure reference links its **direct target** only if that target is among this compiled scheme's own token keys; otherwise it inlines the referencing token's own resolved value. Concat keeps literals exactly and projects each reference part independently, linking an emitted target or inlining that part's retained `value`. There are no invented separators or `var(--target, fallback)` fallbacks.

The exporter receives an already-selected scheme and never selects or adds dependencies. An internal target included by `selection: "all"` or exact keys can link; a public target omitted by exact keys is inlined. ADR 0013 D8's internal/public example describes ordinary public selection: actual emitted membership governs all selections. For A → B → C with only A and C emitted, A is inlined; it does not bypass B. A CSS variable declared elsewhere in the application does not make an omitted target eligible.

Links reuse `variableByToken[target]`, honoring `prefix` and `variableName`. Names are built once in canonical code-unit key order, only for selected tokens. A failed or colliding target name fails the export rather than changing a link into literal output. Compiled values and metadata are unchanged, reference resolution is not rerun, and bare strings containing `var(...)` remain opaque.

### Where links stay live

Every activation block declares every emitted token, including aliases whose `var()` text is identical across modes. CSS computes a custom property on its declaration element, so a target override on an element receiving a mode block propagates through its aliases and linked concat parts. Nested light/dark/light blocks redeclare aliases locally; declaration order does not matter, so aliases can precede their targets in canonical key order.

With generated tokens in `cascadeLayer: "tokens"`, a same-element unlayered target override wins and propagates through those aliases whether the application stylesheet comes before or after the tokens. Inlined concat parts stay fixed. On an **unmarked descendant**, overriding only the target does not update an inherited alias: the alias inherits its ancestor's already-computed value. Redeclare the alias there, or apply an activation condition that emits its complete block.

### Concat uses CSS token substitution

Core concat joins characters; CSS `var()` substitutes token streams. The exporter preserves the authored composition without interpreting its context:

- `calc(var(--spacing) * 2)` can stay live when consumed as a width or padding value.
- With `--number: 20`, `var(--number)px` is not equivalent to `20px`; the number and `px` remain separate CSS tokens. Used as padding, the projected value is invalid and the browser uses the property's initial value.
- Inside a quoted CSS string, inserted `var(--number)` remains literal text, not a live reference. A concat that resolves to `"20"` projects to `"var(--number)"`.

Use resolved output for arbitrary character assembly. There is no context-sensitive inlining, quoting repair, separator inference, or automatic `calc()` rewrite. The three-engine browser suite records these limits alongside live projection.

## Activation tiers

A block holds one mode's declarations under one condition. A mode activates through four tiers, emitted in this order:

1. **default**: the default mode at `activation.root`, which defaults to `:root`.
2. **media**: `activation.media` maps modes to media conditions at that root, including `print`.
3. **attribute**: `activation.attribute` explicitly opts into one `data-*` marker per mode. Omission emits no markers.
4. **selector**: `activation.selectors` maps modes to selector strings, single `{ selector, media? }` objects, or non-empty lists of those objects.

Within a tier, blocks follow the graph's authored mode order; within one mode, the order of its conditions. Modes are never sorted, and the default is not moved first. Every generated selector, custom ones included, is wrapped in `:where()` and has zero specificity, so when several blocks match one element, the later one wins. That makes attribute markers beat media activation, and selector conditions beat both.

Every block declares every selected token, even where a value equals another mode's. A later matching block therefore replaces every declaration of an earlier one, including on nested elements.

Attribute markers are unanchored and include the default mode, so nested elements can switch back to it. Unknown marker values match no block. The string shorthand targets ordinary elements only. Set `activation.attribute` to `{ name: "data-mode", includeHost: true }` to add `:host([data-mode="dark"])` beside `[data-mode="dark"]`. `activation.root` affects only default and media rules; `:root`, `:host`, `:host(.app)`, `#app`, and `.theme-root` never change attribute targeting.

## Selector conditions

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const scheme = orThrow(
  compileTokenGraph(
    defineTokenGraph({
      modes: ["light", "dark", "dim"],
      defaultMode: "light",
      tokens: { surface: { light: "#ffffff", dark: "#111111", dim: "#2a2a2a" } },
    }),
  ),
);

const cssVars = orThrow(
  exportCssVars(scheme, {
    activation: {
      selectors: {
        dark: ".dark",
        dim: [
          { selector: ".dim" },
          { selector: ".dark:not(.high-contrast)", media: "(prefers-contrast: less)" },
        ],
      },
    },
  }),
);
```

Conditions are unanchored and may overlap. When conditions of two modes match one element, the mode that comes later in the graph's authored order wins, so author related modes from general to specific. Use `:not()` in a selector when conditions must stay disjoint. The exporter never generates exclusions: an element with two mode classes, such as `.light.dark`, resolves to the later mode, but that is an application error, not a supported way to express intent.

The `activation.media` and `activation.selectors` maps are partial and typed to the compiled mode union: TypeScript rejects an unknown mode of a literal scheme, and runtime returns `unknown-condition-mode` for dynamic input. Omitting `activation.attribute` emits no markers.

## Application CSS and cascade layers

Generated declarations follow the ordinary cascade. Origin, importance, inline styles, and cascade layers are compared before specificity. In the same layer, an application rule with any specificity overrides a generated declaration whether its stylesheet comes before or after the tokens, and a zero-specificity rule such as `:where(…)` competes by order.

`cascadeLayer: "tokens"` wraps the complete output, media blocks included, in `@layer tokens`. Unlayered normal declarations then win over the tokens regardless of specificity or order; declarations in layers ordered after it win, those in layers ordered before it lose; `!important` reverses layer order. The exporter never emits `!important`. Nested names such as `app.tokens` are accepted.

The exporter emits custom properties only. A mode-level value such as `color-scheme` is a token that your CSS binds. Because `color-scheme` inherits as a computed value, a binding on `:root` alone leaves a nested dark section light. Bind it wherever a mode can activate:

```css
:root,
[data-theme] {
  color-scheme: var(--color-scheme);
}
```

A universal `:where(*) { color-scheme: var(--color-scheme); }` binding also covers selector conditions.

## Structured blocks

Each block reports its `tier`, `mode`, `selectors`, optional `media`, and `declarations` of token key, property, and value. The declaration `value` is the exact complete, safety-checked string inserted into CSS in either format. Its CSS rule is `:where(<selectors joined by ", ">)`, inside `@media <media>` when present. Blocks preserve declaration fidelity; they do not independently encode pretty/compact formatting or the `cascadeLayer` wrapper. Token order, block order, formatting, and trailing-newline behavior are deterministic.

## Names

Default names are `--`, the optional lower-kebab `prefix` and a hyphen, then the token-key segments joined with single hyphens: `action.primary.background` becomes `--action-primary-background`, and `md.sys.color.on-primary` becomes `--md-sys-color-on-primary`. Keys such as `a-b.c` and `a.b-c` then share `--a-b-c`. Every such collision among the exported tokens returns `duplicate-css-variable` with the first key in code-unit order, the later key, and the shared property; internal tokens outside the selection never collide.

## Advanced variable names

Use `variableName` only when integration requires a non-default property mapping:

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const compiled = compileTokenGraph(defineTokenGraph({ tokens: { background: "#ffffff" } }));

if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    variableName({ tokenKey, defaultName }) {
      return tokenKey === "background" ? "--surface" : defaultName;
    },
  });
}
```

The callback runs once per selected token in canonical code-unit order, never for omitted targets or again for a reference. Its actual result supplies both declarations and links. A thrown exception, unsafe custom-property name, or collision becomes a structured failure issue.

## Safety and grammar

Compilation and serialization preserve arbitrary token strings. CSS export is a stricter code-emission boundary: declaration-unsafe values return `invalid-css-value` instead of being written. The check does not interpret color, spacing, or any other token semantics.

The compiled artifact is structurally parsed before exporter options. The parser validates retained-expression structure, not agreement with resolved tokens or acyclicity of edited retained references; projection does not recompile or add a graph validator. It checks each complete value it actually emits once per key/mode, only for modes with an activation block. An emitted target's own declaration is checked too.

Resolved output and direct use of `/tokens/<key>/<mode>` preserve that diagnostic path. An unsafe retained concat projection instead points to the complete `/metadataByToken/<key>/expressionByMode/<mode>` expression, with `key` and `mode`. In `"var"` output, unused resolved alias/concat values and unused retained fallbacks are not checked, nor are individual literal/fallback fragments: `"calc("` and `")"` may be safe as parts of a complete declaration. Unsafe retained concat can therefore fail despite benign resolved tokens, while a safe projection can pass when its unused resolved value is unsafe.

Naming failures and collisions do not stop independent projected-value checks. Invalid names are never inserted into the strings being checked, so they do not cause artificial value issues; any naming issue still prevents successful CSS output.

CSS safety checks protect CSS syntax and declaration boundaries. The returned CSS string is not HTML-escaped: even a quoted CSS string containing `</style>` can terminate a style element when interpolated into HTML source. If generated CSS can contain untrusted strings, do not interpolate it into HTML markup; assign stylesheet text through the DOM, for example with a style element's `textContent`. These checks do not sanitize valid CSS semantics.

Selectors, media conditions, and layer names use intentionally bounded grammars rather than the complete browser language:

- selectors: type, universal, class, id, and attribute selectors, `:root`, `:host`, `:host(<compound>)`, and `:is()`, `:not()`, `:where()` over selector lists, with combinators and commas; at most 256 characters and eight nested functional pseudo-classes;
- media conditions: `all`, `print`, or `screen`, optionally after `not` or `only` and before `and` conditions, or parenthesized features such as `(prefers-color-scheme: dark)` or `(width >= 48rem)` joined by `not`, `and`, or `or`; lowercase, no comma-separated lists, at most 256 characters and eight nested parentheses;
- layer names: dot-separated lower-kebab segments that are not CSS-wide keywords.

Every failure is collected into one issue tuple. See [Diagnostics](../reference/diagnostics.md) for codes and fields.

For a framework bridge that keeps runtime variables application-owned, see
[Tailwind CSS v4](./tailwind-css-v4.md).
