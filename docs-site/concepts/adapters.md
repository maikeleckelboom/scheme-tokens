# Adapters

The root package stays dependency-light. Optional capabilities live in adapter packages.

## Source Adapters

Source adapters generate core graph input before `buildScheme()` compiles a scheme. `@scheme-tokens/material3` is the
current source adapter and uses a real Material algorithm outside the root package.

## Conversion Adapters

Conversion adapters are future post-compile operations for color conversion, gamut mapping, or projection. A future
`@scheme-tokens/texel` package is planned for Texel-backed conversion work. The root package does not perform hidden
conversion.

## Target Adapters

Target adapters are future packages for framework or design-system contracts. A future `@scheme-tokens/shadcn` package
may map compiled or core token material into shadcn's CSS-variable contract. Material roles should still be mapped
explicitly into app-owned tokens before target-specific export behavior.

## Format Adapters

Format adapters import or export external file and wire formats. A future `@scheme-tokens/dtcg` package is planned for
DTCG. Style Dictionary, Tokens Studio, Terrazzo, and other ecosystem bridges remain future directions unless an adapter
package ships them.

## Tooling Integrations

Build-tool integrations such as an unplugin package are future ecosystem work. In 0.1.0, use build-time scripts, SSR, or
server-side generation and pass CSS artifacts to the app explicitly.

Adapters should return `Result` values with adapter-owned issue codes, keep public data JSON-safe, and prove the root
package remains engine-free.
