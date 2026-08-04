# Changesets

Every change that alters published behaviour needs a changeset. Add one with:

```sh
pnpm changeset
```

That writes a markdown file in this directory recording the bump type and the
consumer-facing summary. `pnpm changeset:version` applies the pending files to
`package.json` and `CHANGELOG.md`.

The published API surface is snapshotted in [`api/scheme-tokens.api.d.ts`](../api/scheme-tokens.api.d.ts).
CI fails when that snapshot moves without a changeset in the same branch, so the
version bump and the changelog entry cannot drift away from the contract.

Before `1.0.0`, a minor release may change a public contract; see
[docs/semver.md](../docs/semver.md).
