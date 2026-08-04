---
"scheme-tokens": patch
---

Add release tooling around the published contract: changesets, a committed API
surface snapshot at `api/scheme-tokens.api.d.ts`, and CI gates that run publint
and `@arethetypeswrong/cli` against the packed tarball, install that tarball
into a scratch project under both `bundler` and `node16` module resolution, and
fail when the API snapshot moves without a changeset. No published behaviour
changes.
