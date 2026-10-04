---
"@scheme-tokens/material3": minor
---

Return one validated mode-aware TokenLayer instead of a graph fragment. Compose with `layers: [material]` and declare the graph's modes/defaultMode explicitly. The exact, non-empty `modeSettings` map replaces additive `modes` and `exactModes`; custom graph modes require `colorMode`, replacing `appearance`. The positional source remains the only global source, with per-mode source/variant/contrast overrides validated before generation.

Export Material3ColorMode, Material3ModeSettings and Material3Options, remove Material3Appearance and Material3GraphFragment, and preserve exact mode/visibility inference with NoInfer. Generated roles omit authored visibility, matching core's current LayerVisibilityFacts contract. The adapter now requires scheme-tokens ^0.4.0; earlier core minors are unsupported. Engine algorithms and 48-role output are unchanged.
