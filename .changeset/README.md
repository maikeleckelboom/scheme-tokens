# Changesets

Add a changeset for a published behavior or API change:

```sh
pnpm changeset
```

The file records the package, bump type, and user-facing summary.
`pnpm changeset:version` applies pending files to manifests and generated changelogs.

Before `1.0.0`, breaking changes use a minor release. Peer ranges record supported compatibility
and need matching evidence when expanded. See [Semver](../docs/semver.md) and
[Development](../docs/development.md#api-snapshots-and-changesets) for the release checks.
