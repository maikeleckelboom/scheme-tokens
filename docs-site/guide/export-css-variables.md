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
    prefix: "color",
    system: { dark: "(prefers-color-scheme: dark)" },
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

## Activation tiers

A block holds one mode's declarations under one condition. A mode activates through four tiers, emitted in this order:

1. **base**: the default mode at `root`. `root` defaults to `:root`; use `:host` in a shadow root.
2. **system**: `system` maps a mode to a media condition at `root`. There is no default, because core does not know which mode is dark.
3. **explicit**: one attribute marker per mode on any element. `attribute` defaults to `data-theme` when the scheme has more than one mode; set another `data-*` name, or `false` for no markers.
4. **custom**: `selectors` maps a mode to one selector or to a list of `{ selector, media? }` conditions.

Within a tier, blocks follow the graph's authored mode order; within one mode, the order of its conditions. Modes are never sorted, and the default is not moved first. Every generated selector, custom ones included, is wrapped in `:where()` and has zero specificity, so when several blocks match one element, the later one wins. That makes explicit markers beat the system preference, and custom conditions beat both.

Every block declares every selected token, even where a value equals another mode's. A later matching block therefore replaces every declaration of an earlier one, including on nested elements.

Explicit markers are unanchored and include the default mode, so any element can switch modes, and a light island inside a dark section works. A marker value that is not a mode, such as `data-theme="system"`, matches no block and leaves the system preference in charge. With `root: ":host"`, the base and system blocks target the host, and each marker covers the host and the shadow tree: `:where(:host([data-theme="dark"]), [data-theme="dark"])`.

## Custom conditions

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
    attribute: false,
    selectors: {
      dark: ".dark",
      dim: [
        { selector: ".dim" },
        { selector: ".dark:not(.high-contrast)", media: "(prefers-contrast: less)" },
      ],
    },
  }),
);
```

Conditions are unanchored and may overlap. When conditions of two modes match one element, the mode that comes later in the graph's authored order wins, so author related modes from general to specific. Use `:not()` in a selector when conditions must stay disjoint. The exporter never generates exclusions: an element with two mode classes, such as `.light.dark`, resolves to the later mode, but that is an application error, not a supported way to express intent.

The system and custom maps are partial and typed to the compiled mode union: TypeScript rejects an unknown mode of a literal scheme, and the runtime returns `unknown-condition-mode` for dynamic input. Omitting `attribute` selects the conventional default, while `attribute: false` generates no markers.

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

A universal `:where(*) { color-scheme: var(--color-scheme); }` binding also covers custom conditions.

## Structured blocks

Each block reports its `tier`, `mode`, `selectors`, optional `media`, and `declarations` of token key, property, and value. Its CSS rule is `:where(<selectors joined by ", ">)`, inside `@media <media>` when present, so an application can re-emit blocks without parsing CSS. Token order, block order, formatting, and trailing-newline behavior are deterministic, in both `pretty` and `compact` output.

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

The callback runs in deterministic token order. A thrown exception, unsafe custom-property name, or collision becomes a structured failure issue.

## Safety and grammar

Compilation and serialization preserve arbitrary token strings. CSS export is a stricter code-emission boundary: declaration-unsafe values return `invalid-css-value` instead of being written. The check does not interpret color, spacing, or any other token semantics.

CSS safety checks protect CSS syntax and declaration boundaries. The returned CSS string is not HTML-escaped: even a quoted CSS string containing `</style>` can terminate a style element when interpolated into HTML source. If generated CSS can contain untrusted strings, do not interpolate it into HTML markup; assign stylesheet text through the DOM, for example with a style element's `textContent`. These checks do not sanitize valid CSS semantics.

Selectors, media conditions, and layer names use intentionally bounded grammars rather than the complete browser language:

- selectors: type, universal, class, id, and attribute selectors, `:root`, `:host`, `:host(<compound>)`, and `:is()`, `:not()`, `:where()` over selector lists, with combinators and commas; at most 256 characters and eight nested functional pseudo-classes;
- media conditions: `all`, `print`, or `screen`, optionally after `not` or `only` and before `and` conditions, or parenthesized features such as `(prefers-color-scheme: dark)` or `(width >= 48rem)` joined by `not`, `and`, or `or`; lowercase, no comma-separated lists, at most 256 characters and eight nested parentheses;
- layer names: dot-separated lower-kebab segments that are not CSS-wide keywords.

Every failure is collected into one issue tuple. See [Diagnostics](../reference/diagnostics.md) for codes and fields.

For a framework bridge that keeps runtime variables application-owned, see
[Tailwind CSS v4](./tailwind-css-v4.md).
