---
"scheme-tokens": patch
"@scheme-tokens/material3": patch
---

Expand supported consumer compilers to `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
The authoritative core and full P5.1 Material matrices run against actual source and paired
tarballs, with strict-only and stricter settings, skipLibCheck false and consumer declaration
emission. The repository retains TypeScript 7 development tooling. Runtime behavior and
declarations are unchanged. The existing pending minor changesets still project core 0.4.0
and Material 0.2.0 with peer ^0.4.0; no primary-worktree versioning is applied.
