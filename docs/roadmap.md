# Roadmap

The 0.1 line is released. It carries one complete pipeline:

```text
authored string tokens -> strict graph -> deterministic compilation -> CSS or serialized artifacts
```

## What 0.1 settled

- One authoring grammar and one `Result` convention.
- Multimode authority explicit at the graph boundary.
- Layers ordered, mode-neutral, and independently identifiable.
- Strict graph, layer, and compiled formats aligned with their schemas and parsers.
- Deterministic diagnostics, serialization, selection, and CSS output.
- Literal key and mode inference proven through strict packed consumers.
- A consumer-shaped graph validated end to end: generated internal strings, public semantic references, explicit repair tokens, light and dark modes, layers, and persisted parsing.

## After 0.1

- Keep the compiler itself stable. Before `1.0.0`, a contract change is allowed when it simplifies the package, and it ships as a minor bump with a changeset rather than as a compatibility alias.
- Grow composition around the compiler, in packages outside the core boundary, so the root package stays dependency-light and browser-runnable.
- The first such package is `@scheme-tokens/material3`, an optional sibling that generates one
  finite Material system-color layer while leaving compilation and artifact projection in core.
- Record each such decision as an ADR under `docs/adr/` before it turns into code.

## Deliberate non-goals

- Structured or domain-specific token value systems.
- Palette generation or value interpretation.
- Product policy, role taxonomies, proof models, or repair decisions.
- Runtime plugin, source, provider, preset, or registry frameworks.

Future work should extend composition around the stable compiler rather than broaden the root package into a design-system framework.
