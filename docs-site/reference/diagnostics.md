# Diagnostics

Recoverable failures return `Result` objects with non-empty `issues`.

```ts
type Result<Value, I extends Issue = Issue> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [I, ...I[]] };
```

`Issue.code` and JSON Pointer `path` values are contractual. Message text is explanatory.

## Common Codes

| Code                     | Meaning                                           |
| ------------------------ | ------------------------------------------------- |
| `missing-property`       | A strict artifact is missing a required field.    |
| `unknown-property`       | A strict artifact has a field outside contract.   |
| `invalid-token-key`      | A token key is not dot-separated lower-kebab.     |
| `invalid-token-value`    | A token value is not a string or valid reference. |
| `invalid-reference`      | A reference shape or target key is invalid.       |
| `unknown-reference`      | A reference target is missing.                    |
| `circular-reference`     | References form a cycle.                          |
| `duplicate-css-variable` | Two tokens produce the same CSS variable name.    |

Adapter packages own adapter-specific issue codes. `buildScheme()` may surface those issues without widening root issue
contracts.
