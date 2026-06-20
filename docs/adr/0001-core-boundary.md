# ADR 0001: Core Package Boundary

## Status

Accepted.

## Context

The package is pre-`1.0.0`, so the first public contract should stay small and explicit. Without a clear boundary, one
package could accumulate core graph behavior, Material 3 generation, Texel conversion, CSS parser validation, and other
optional capability engines.

## Decision

`scheme-tokens` is the dependency-light core package. It exposes the root API and JSON Schema subpaths only.

Material 3 support, Texel-backed conversion, image extraction, browser canvas behavior, rich CSS parsing, and other
engine-backed behavior must live in separate adapter packages. Intended future package names include:

- `@scheme-tokens/material3`;
- `@scheme-tokens/texel`.

The core package may expose adapter interfaces such as `ColorTokenSource`, but it must not import adapter engines or fake their
behavior.

## Consequences

- Root imports do not load optional engines.
- The package has no runtime dependencies.
- `/material3` and `/conversion` are not core subpaths.
- Material 3 output is not approximated inside core.
- Adapter packages must return core graph inputs and report recoverable failures with `Result` and `Issue`.
