# Theme coordinates

The example keeps palette and light/dark scheme as separate application choices and maps them
to four graph modes: mono-light, mono-dark, vivid-light, and vivid-dark.

[theme.ts](./theme.ts) resolves public aliases through internal source tokens and activates modes
with `data-palette` and `data-scheme`. [material.ts](./material.ts) uses a Material layer across
six modes.

Run the packed core example from the repository root:

```sh
pnpm check:theme-coordinate-consumer
```

This installs the package tarball in a strict NodeNext consumer, then typechecks and executes
`theme.ts`. `pnpm typecheck` also checks the repository source. The paired Material example runs
through `pnpm --filter @scheme-tokens/material3 check:packed-consumers`.

See [Application theme coordinates](../../docs/application-theme-coordinates.md) for the
activation recipe.
