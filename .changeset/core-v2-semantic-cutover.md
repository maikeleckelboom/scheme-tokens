---
"scheme-tokens": minor
---

Cut the core runtime and wire model over to v2. Remove `defineTokens` in favor of one-object `defineTokenGraph`, add canonical flat concat and reference-only `tokenConcat` templates, and expose `orThrow` with complete structured error causes.

Compose ordered layers before graph tokens, preserve visibility through omitted overrides, and validate layer mode sets at runtime. Compiled metadata now records complete `declarations` and sparse `expressionByMode`, including resolved reference-part values for concat, instead of the old winning origin and dependency records. Resolution uses one iterative bounded DAG engine with deterministic cycles and original reference pointers.

Write format version 2 and export only self-contained v2 schemas. Continue reading v1 source graphs/layers through a deterministic lossless upgrade that preserves published values, visibility, metadata, and mode order, including the valid `concat` mode. Reject compiled v1 with a request to recompile source. V2 schema hints are optional uninterpreted strings; trusted helpers do not accept them. Native v2 preserves authored mode order.

The advanced static inference model, CSS activation/naming redesign, and next Material API remain deferred.
