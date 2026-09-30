---
"@scheme-tokens/material3": minor
---

Tie returned mode and visibility facts to supplied options. Non-default mode sets require
`modes`, and visibility types excluding public require `visibility`. Omitted or undefined
options use a non-generic default-call signature; wrappers must narrow or default possibly
undefined options before forwarding. Preserve literal inference, contextual NoInfer protection,
and runtime generation defaults.
