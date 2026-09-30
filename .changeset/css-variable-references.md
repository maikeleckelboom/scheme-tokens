---
"scheme-tokens": minor
---

Add optional `references: "var"` to `exportCssVars()`. Resolved output remains the default and is unchanged when the option is omitted, explicitly undefined, or `"resolved"`. Retained references link their direct targets only when emitted by this selected scheme, using the actual prefix/custom variable names built once. Other pure references inline their own resolved values; concat preserves literals and links or inlines each reference part independently, without adding dependencies or bypassing omitted intermediates.

Every activation block still declares every selected token, including aliases, in canonical key order. Local target overrides propagate through linked aliases; an unmarked descendant's override does not update an inherited alias. CSS token-stream substitution differs from arbitrary character concatenation: dimensional suffix assembly and inserted `var()` inside quoted strings are not repaired. Resolved output remains available for those uses.

Safety checks use the exact complete projected declaration shared by blocks and CSS formatting. Unsafe retained concat uses `invalid-css-value` at `/metadataByToken/<key>/expressionByMode/<mode>`; resolved/direct token values retain `/tokens/<key>/<mode>`. Unused resolved/fallback strings and isolated fragments are not checked in var output. Name failures, collisions, and independent unsafe projected declarations remain collected failures. Invalid references options use `invalid-css-options` with `option: "references"`. Compiled parsing remains structural; no metadata consistency or graph validation is added.
