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
- Unknown-value descriptions are bounded and avoid user-code coercion.
- Internal thrown errors are reserved for impossible library states, not normal input failure.
