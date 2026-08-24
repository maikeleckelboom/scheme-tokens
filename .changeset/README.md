# Changesets

Every change that alters published behaviour needs a changeset. Add one with:

```sh
pnpm changeset
```

That writes a markdown file in this directory recording the bump type and the
consumer-facing summary. `pnpm changeset:version` applies the pending files to
`package.json` and `CHANGELOG.md`.

The published TypeScript surface is snapshotted in
[`api/scheme-tokens.api.d.ts`](../api/scheme-tokens.api.d.ts). CI fails when that
snapshot moves without a changeset in the same branch. Behavioural contract
changes that leave declarations unchanged are not automatically detectable and
still require a changeset through repository policy and review.

Before `1.0.0`, a minor release may change a public contract; see
[docs/semver.md](../docs/semver.md).

Workspace peer ranges record deliberately proven compatibility. The pinned
Changesets configuration preserves a peer range when the versioned dependency
still satisfies it, while an out-of-range release still forces an update. This
keeps an explicit range such as `^0.2.0 || ^0.3.0` intact during candidate
versioning; do not widen that range without matching compatibility evidence.
