import {
  material3,
  type Material3ColorMode,
  type Material3Modes,
  type Material3Options,
  type Material3TokenKey,
} from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  tokenRef,
  type CompiledToken,
  type TokenLayer,
  type TokenVisibility,
} from "scheme-tokens";
// @ts-expect-error the fragment export is removed without an alias.
import type { Material3GraphFragment } from "@scheme-tokens/material3";
// @ts-expect-error appearance is replaced by colorMode without an alias.
import type { Material3Appearance } from "@scheme-tokens/material3";
// @ts-expect-error per-mode settings stay unexported.
import type { Material3ModeSettings } from "@scheme-tokens/material3";
// @ts-expect-error overrides stay unexported.
import type { Material3ModeOverrides } from "@scheme-tokens/material3";
// @ts-expect-error the empty-map marker stays unexported.
import type { Material3ModesMustNotBeEmpty } from "@scheme-tokens/material3";

// Export references keep these negative imports used without executing them.
export type RemovedExports =
  | Material3GraphFragment
  | Material3Appearance
  | Material3ModeSettings
  | Material3ModeOverrides
  | Material3ModesMustNotBeEmpty;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;
type MaterialLayer<Mode extends string, Visibility extends TokenVisibility> = TokenLayer<
  Material3TokenKey,
  Mode,
  {
    readonly default: Visibility;
    readonly public: never;
    readonly internal: never;
    readonly omitted: Material3TokenKey;
  }
>;

const defaults = material3("#6750a4");
export type DefaultsProof = Expect<
  Equal<typeof defaults, MaterialLayer<Material3ColorMode, "public">>
>;
const internal = material3("#6750a4", { visibility: "internal" });
export type InternalProof = Expect<
  Equal<typeof internal, MaterialLayer<Material3ColorMode, "internal">>
>;
const checkedOptions = {
  visibility: "internal",
  variant: "expressive",
  modes: { light: {}, dark: {} },
} satisfies Material3Options;
export type SettingsProof = Expect<Equal<typeof checkedOptions.variant, "expressive">>;
const checked = material3("#6750a4", checkedOptions);
export type CheckedProof = Expect<
  Equal<typeof checked, MaterialLayer<Material3ColorMode, "internal">>
>;
const wideOptions: Material3Options = { visibility: "internal" };
const uncertain = material3("#6750a4", wideOptions);
export type WideOptionsProof = Expect<
  Equal<typeof uncertain, MaterialLayer<Material3ColorMode, TokenVisibility>>
>;

const compilerModes = [
  "mono-light",
  "mono-dark",
  "vivid-light",
  "vivid-dark",
  "material3-light",
  "material3-dark",
] as const;
type CompilerMode = (typeof compilerModes)[number];
const materialModes = {
  "mono-light": { colorMode: "light", variant: "monochrome" },
  "mono-dark": { colorMode: "dark", variant: "monochrome" },
  "vivid-light": { colorMode: "light" },
  "vivid-dark": { colorMode: "dark" },
  "material3-light": { colorMode: "light", sourceColor: "#009489" },
  "material3-dark": { colorMode: "dark", contrastLevel: 0.5 },
} as const satisfies Material3Modes<CompilerMode>;
const six = material3("#6750a4", { modes: materialModes, visibility: "internal" });
export type SixModeProof = Expect<Equal<typeof six, MaterialLayer<CompilerMode, "internal">>>;

function forward<Mode extends string, Visibility extends TokenVisibility>(
  options: Material3Options<Mode, Visibility>,
) {
  return material3("#6750a4", options);
}
const wrapped = forward({ modes: materialModes, visibility: "internal" });
export type WrapperProof = Expect<Equal<typeof wrapped, MaterialLayer<CompilerMode, "internal">>>;
const wrapperOptions = { modes: materialModes, visibility: "internal" } satisfies Material3Options<
  CompilerMode,
  "internal"
>;
export type WrapperOptionsProof = Expect<
  Equal<
    typeof forward<CompilerMode, "internal">,
    (options: Material3Options<CompilerMode, "internal">) => MaterialLayer<CompilerMode, "internal">
  >
>;
void wrapperOptions;

const one = material3("#6750a4", { modes: { standard: { colorMode: "light" } } });
export type OneModeProof = Expect<Equal<typeof one, MaterialLayer<"standard", "public">>>;
const concat = material3("#6750a4", { modes: { concat: { colorMode: "dark" } } });
export type ConcatModeProof = Expect<Equal<typeof concat, MaterialLayer<"concat", "public">>>;
material3("#6750a4", { modes: { light: { sourceColor: "#009489" } } });
material3("#6750a4", { modes: { dark: {} } });

// @ts-expect-error missing mode in an exact checked map.
const missing = { light: {} } satisfies Material3Modes<Material3ColorMode>;
const extra = {
  light: {},
  dark: {},
  // @ts-expect-error extra mode in an exact checked map.
  dim: { colorMode: "dark" },
} satisfies Material3Modes<Material3ColorMode>;
// @ts-expect-error an empty inline map must not fabricate an invariant layer.
material3("#6750a4", { modes: {} });
// @ts-expect-error an annotated empty map is rejected by the named diagnostic marker.
const empty: Material3Modes<never> = {};
// @ts-expect-error satisfies must reject the same empty map.
const emptyChecked = {} satisfies Material3Modes<never>;
void [missing, extra, empty, emptyChecked];

// @ts-expect-error custom mode requires colorMode.
material3("#6750a4", { modes: { custom: { contrastLevel: 1 } } });
// @ts-expect-error concat is a custom mode requiring colorMode.
material3("#6750a4", { modes: { concat: {} } });
// @ts-expect-error invalid colorMode.
material3("#6750a4", { modes: { custom: { colorMode: "dim" } } });
// @ts-expect-error redundant built-in light colorMode.
material3("#6750a4", { modes: { light: { colorMode: "light" } } });
// @ts-expect-error redundant built-in dark colorMode.
material3("#6750a4", { modes: { dark: { colorMode: "dark" } } });
// @ts-expect-error no string shorthand.
material3("#6750a4", { modes: { custom: "light" } });
// @ts-expect-error positional source is the only global source.
material3("#6750a4", { sourceColor: "#ff0000" });
// @ts-expect-error removed exactModes.
material3("#6750a4", { exactModes: { light: {} } });
// @ts-expect-error the graph owns defaultMode.
material3("#6750a4", { defaultMode: "light" });
// @ts-expect-error removed appearance in settings.
material3("#6750a4", { modes: { custom: { colorMode: "light", appearance: "light" } } });
// @ts-expect-error no global appearance.
material3("#6750a4", { appearance: "light" });
// @ts-expect-error specVersion stays global.
material3("#6750a4", { modes: { dark: { specVersion: "2025" } } });
// @ts-expect-error visibility stays global.
material3("#6750a4", { modes: { dark: { visibility: "internal" } } });
// @ts-expect-error platform is fixed internally.
material3("#6750a4", { platform: "phone" });
// @ts-expect-error unknown public option.
material3("#6750a4", { unknown: true });
// @ts-expect-error visibility has exactly two values.
material3("#6750a4", { visibility: "private" });
// @ts-expect-error fragment envelope no longer exists.
void defaults.modes;
// @ts-expect-error fragment layers no longer exist.
void defaults.layers;
// @ts-expect-error fragment default no longer exists.
void defaults.defaultMode;
// @ts-expect-error exact 48-role key union.
const misspelled: Material3TokenKey = "md.sys.color.primari";
void misspelled;

// X1: NoInfer prevents an annotated variable fabricating modes.
// @ts-expect-error default material only generates light and dark.
const fabricated: TokenLayer<Material3TokenKey, CompilerMode> = material3("#6750a4");
// X2: NoInfer prevents a declared return type fabricating modes.
function fabricatedReturn(): TokenLayer<Material3TokenKey, CompilerMode> {
  // @ts-expect-error return context cannot supply generated modes.
  return material3("#6750a4");
}
// X3: NoInfer prevents a typed layer list fabricating modes.
// @ts-expect-error list context cannot supply generated modes.
const fabricatedList: readonly TokenLayer<string, CompilerMode>[] = [material3("#6750a4")];
// @ts-expect-error context cannot turn omitted visibility into internal.
const fabricatedVisibility: MaterialLayer<Material3ColorMode, "internal"> = material3("#6750a4");
void [fabricated, fabricatedReturn, fabricatedList, fabricatedVisibility];

defineTokenGraph({ modes: compilerModes, defaultMode: "mono-light", layers: [six], tokens: {} });
defineTokenGraph({ modes: ["dark", "light"], defaultMode: "dark", layers: [defaults], tokens: {} });
defineTokenGraph({ modes: ["standard"], defaultMode: "standard", layers: [one], tokens: {} });
defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  // @ts-expect-error default layer cannot cover six modes, inline.
  layers: [material3("#6750a4")],
  tokens: {},
});
defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  // @ts-expect-error held default layer cannot cover six modes.
  layers: [defaults],
  tokens: {},
});
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  // @ts-expect-error six-mode layer cannot fit a light/dark graph.
  layers: [six],
  tokens: {},
});
const largerModes = ["light", "dark", "dim"] as const;
defineTokenGraph({
  modes: largerModes,
  defaultMode: "light",
  // @ts-expect-error mode sets must be equal, not subsets.
  layers: [defaults],
  tokens: {},
});
defineTokenGraph({
  modes: ["light", "dark", "dim"],
  defaultMode: "light",
  // @ts-expect-error the same mismatch is rejected for inline calls.
  layers: [material3("#6750a4", { modes: { light: {}, dark: {} } })],
  tokens: {},
});

declare const dynamicModes: Material3Modes<string>;
const dynamic = material3("#6750a4", { modes: dynamicModes });
export type DynamicModesProof = Expect<Equal<typeof dynamic, MaterialLayer<string, "public">>>;
defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  layers: [dynamic],
  tokens: {},
});
declare const runtimeModes: readonly [string, ...string[]];
defineTokenGraph({ modes: runtimeModes, defaultMode: "any", layers: [defaults], tokens: {} });

const publicGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [defaults],
  tokens: { alias: tokenRef("md.sys.color.primary") },
});
const publicOutput = orThrow(compileTokenGraph(publicGraph));
const explicitPublic = orThrow(compileTokenGraph(publicGraph, { selection: "public" }));
export type PublicCompleteProof = Expect<
  Equal<
    typeof publicOutput.tokens,
    Readonly<Record<Material3TokenKey | "alias", CompiledToken<Material3ColorMode>>>
  >
>;
export type ExplicitPublicProof = Expect<
  Equal<typeof publicOutput.tokens, typeof explicitPublic.tokens>
>;
const publicCss = orThrow(exportCssVars(publicOutput));
const exactCssName: string = publicCss.variableByToken["md.sys.color.primary"];
void exactCssName;
const internalGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [internal],
  tokens: {
    "md.sys.color.primary": "#ff0055",
    alias: tokenRef("md.sys.color.primary"),
  },
});
const internalOutput = orThrow(compileTokenGraph(internalGraph));
export type InternalPublicProof = Expect<
  Equal<typeof internalOutput.tokens, Readonly<Record<"alias", CompiledToken<Material3ColorMode>>>>
>;
const allInternal = orThrow(compileTokenGraph(internalGraph, { selection: "all" }));
export type InternalAllProof = Expect<Equal<typeof allInternal.tokens, typeof publicOutput.tokens>>;
const uncertainGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [uncertain],
  tokens: { alias: tokenRef("md.sys.color.primary") },
});
const uncertainOutput = orThrow(compileTokenGraph(uncertainGraph));
export type UncertainPublicProof = Expect<
  Equal<
    typeof uncertainOutput.tokens,
    Readonly<Partial<Record<Material3TokenKey | "alias", CompiledToken<Material3ColorMode>>>>
  >
>;
// @ts-expect-error unknown visibility cannot promise presence/completeness.
const definitelyPresent: string = uncertainOutput.tokens["md.sys.color.primary"].light;
// @ts-expect-error possibly public roles are not definitely absent either.
const definitelyAbsent: undefined = uncertainOutput.tokens["md.sys.color.primary"];
const uncertainCss = orThrow(exportCssVars(uncertainOutput));
export type UncertainCssProof = Expect<
  Equal<(typeof uncertainCss.variableByToken)["md.sys.color.primary"], string | undefined>
>;
void [definitelyPresent, definitelyAbsent];
const exactUncertain = orThrow(
  compileTokenGraph(uncertainGraph, { selection: { keys: ["md.sys.color.primary"] } }),
);
export type ExactSelectionProof = Expect<
  Equal<
    typeof exactUncertain.tokens,
    Readonly<Record<"md.sys.color.primary", CompiledToken<Material3ColorMode>>>
  >
>;

const brand = defineTokenLayer({
  id: "brand",
  tokens: { "brand.seed": "#6750a4", "md.sys.color.primary": "#ff0055" },
});
const multiGraph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [internal, brand],
  tokens: {
    alias: tokenRef("md.sys.color.primary"),
    "brand.semantic": tokenRef("brand.seed"),
    "md.sys.color.secondary": { value: "#000000", visibility: "public" },
  },
});
const multiPublic = orThrow(compileTokenGraph(multiGraph));
export type MultiPublicProof = Expect<
  Equal<
    keyof typeof multiPublic.tokens,
    "alias" | "brand.seed" | "brand.semantic" | "md.sys.color.secondary"
  >
>;
const multiAll = orThrow(compileTokenGraph(multiGraph, { selection: "all" }));
export type MultiAllProof = Expect<
  Equal<keyof typeof multiAll.tokens, Material3TokenKey | "brand.seed" | "alias" | "brand.semantic">
>;
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [defaults, brand],
  tokens: {
    // @ts-expect-error a misspelled Material reference is rejected by core.
    alias: tokenRef("md.sys.color.primari"),
  },
});
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [defaults, brand],
  tokens: {
    // @ts-expect-error a misspelled ordinary layer reference is rejected by core.
    alias: tokenRef("brand.sead"),
  },
});
