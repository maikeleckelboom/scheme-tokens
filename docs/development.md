# Development

Use the repository validation gates before release work or package-boundary changes:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

`pnpm validate` runs the aggregate type, lint, test, build, filename, API, and formatting checks across the workspace.

`pnpm release:check` adds package-oriented checks: strict package validation, README example type-checking, packed
consumer smoke tests, adapter package release checks, adapter consumer smoke tests, and tarball content checks.

Publishing, tagging, and GitHub release creation are manual maintainer actions outside these validation scripts.

## Release Checklist

Release preparation is a validation and decision gate. Do not publish, tag, push, or create a GitHub release until the
dry run passes and the maintainer has approved the real publish step.

### Dry Run

Run these commands from a clean worktree:

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
pnpm -C packages/source-material3 release:check
pnpm pack --dry-run
pnpm -C packages/source-material3 pack --dry-run
npm publish --dry-run
(cd packages/source-material3 && npm publish --dry-run --access public)
```

Run the final two commands from the package directories they publish:

- run `npm publish --dry-run` from the repository root for `scheme-tokens`;
- run `npm publish --dry-run --access public` from `packages/source-material3` for
  `@scheme-tokens/source-material3`.

Use these read-only npm checks when network access is available:

```bash
npm view scheme-tokens name version
npm view @scheme-tokens/source-material3 name version
npm whoami
```

`npm view` returning a not-found response can mean the package name has not been published yet. `npm whoami` verifies
authentication only; it does not prove permission to publish either package.

### Publish

After approval, publish the packages explicitly and in order:

```bash
npm publish
(cd packages/source-material3 && npm publish --access public)
```

The unscoped `scheme-tokens` package uses normal public npm behavior. The scoped
`@scheme-tokens/source-material3` package requires public access configuration, either through
`publishConfig.access: "public"` or an explicit `--access public` publish command. Do not assume the npm organization,
scope, or package permissions are ready until the dry run and maintainer account checks confirm them.

Only add `--provenance` when the release environment is configured for npm provenance and the maintainer has chosen that
policy. The current package scripts do not enable provenance automatically.

### Tag and Release

Create the git tag and GitHub release only after both npm publishes succeed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create the GitHub release for `v0.1.0` with the published package notes.
