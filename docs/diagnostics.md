# Diagnostics

Recoverable public failures return `Result` objects.

```ts
type Result<Value, I extends Issue = Issue> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [I, ...I[]] };
```

`Issue.code` and JSON Pointer `path` values are contractual. Message text is explanatory and may be refined without
changing the machine contract.

## Rules

- Public parse, compile, source, and export failures return non-empty `issues`.
- Parse boundaries and option validators that accept `unknown` do not throw for malformed unknown input.
- Diagnostics are deterministic across object insertion order.
- Paths point at the narrowest stable input location the parser can identify.
- Layer diagnostics use layer vocabulary and `/layers/...` JSON Pointer paths, including `invalid-layer-id` and
  `duplicate-layer-id`.
- Unknown-value descriptions are bounded and avoid user-code coercion.
- Internal thrown errors are reserved for impossible library states, not normal input failure.
- Adapter-specific issue codes are owned by adapter packages. `buildScheme()` may surface adapter issues, but adapters
  must not cast their issue codes into core issue unions.

## Common Core Codes

- `missing-property`: a strict artifact is missing a required field.
- `unknown-property`: a strict artifact contains a field outside the current contract.
- `invalid-token-key`: a token key is not dot-separated lower-kebab.
- `invalid-token-value`: a token value is not an authored string or explicit reference in a position that allows
  references.
- `invalid-reference`: a reference shape or target key is invalid.
- `unknown-reference`: a reference target is not present in the composed graph.
- `circular-reference`: references form a cycle.
- `duplicate-css-variable`: two exported token keys would produce the same CSS custom-property name.
