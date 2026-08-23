# Theme coordinates

This executable example maps two application-owned axes—palette and light/dark scheme—to four
complete compiler modes: mono-light, mono-dark, vivid-light, and vivid-dark.

Flattening happens only at the compiler boundary. Application state can keep the axes independent
while scheme-tokens receives one explicit mode envelope. The example then selects an exact public
role contract, resolves references through internal source tokens, and projects deterministic CSS
with application-owned selectors.

From the repository root, run:

    pnpm check:theme-coordinate-consumer

The check packs scheme-tokens, installs the tarball with lifecycle scripts disabled, copies this
exact [theme.ts](./theme.ts) source into a strict NodeNext consumer, typechecks it, and executes its
runtime assertions. pnpm typecheck also checks the source directly in the repository.

See [Application Theme Coordinates](../../docs/application-theme-coordinates.md) for the design
boundary and selector/media-query guidance.
