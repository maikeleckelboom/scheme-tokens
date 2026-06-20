# Adapter Policy

Adapters plug into core by returning strict token graph input through `TokenSource`.

```ts
interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}
```

Adapter packages may depend on engines. The core package must not.

`TokenSource` is a structural adapter contract. A source object may include metadata beyond `id` and `build`; core
validates those two members and invokes `build()` with the original source object as the receiver.

## Requirements

- Adapter public inputs should be JSON-safe plain data.
- Recoverable adapter failures should use `Result` with non-empty `issues`.
- Adapter issue codes and paths are adapter contracts.
- Adapter outputs must be strict core graph inputs.
- Adapter packages must not rely on hidden core fallback behavior.

## Future Packages

Material 3 support should live in a package such as `@color-scheme-tokens/source-material3` and use a real Material
algorithm. Texel-backed conversion should live in a package such as `@color-scheme-tokens/conversion-texel`.

Core must not ship approximated Material output as Material 3.
