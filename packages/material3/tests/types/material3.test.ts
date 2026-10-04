import {
  material3,
  type Material3ColorMode,
  type Material3ModeSettings,
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
import type { Material3ModeOptions } from "@scheme-tokens/material3";
// @ts-expect-error overrides stay unexported.
import type { Material3ModeOverrides } from "@scheme-tokens/material3";
// @ts-expect-error the empty-map marker stays unexported.
import type { Material3ModeSettingsMustNotBeEmpty } from "@scheme-tokens/material3";

// Export references keep these negative imports used without executing them.
export type RemovedExports =
  | Material3GraphFragment
  | Material3Appearance
  | Material3ModeOptions
  | Material3ModeOverrides
  | Material3ModeSettingsMustNotBeEmpty;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;
type MaterialLayer<Mode extends string, Visibility extends TokenVisibility> = TokenLayer<
  Material3TokenKey,
  Mode,
  {
    readonly defaultVisibility: Visibility;
    readonly mayStatePublicKeys: never;
    readonly mayStateInternalKeys: never;
    readonly mayOmitVisibilityKeys: Material3TokenKey;
  }
>;

const defaults = material3("#6750a4");
// P5.1: annotations cannot establish settings that may be absent at runtime.
// @ts-expect-error custom modes require the modes field.
const absentModes: Material3Options<"custom"> = {};
// @ts-expect-error internal visibility requires the visibility field.
const absentVisibility: Material3Options<Material3ColorMode, "internal"> = {};
// @ts-expect-error both non-default settings are required.
const absentBoth: Material3Options<"custom", "internal"> = {};
// @ts-expect-error an unrelated option does not establish custom modes.
const unrelatedModes: Material3Options<"custom"> = { variant: "expressive" };
// @ts-expect-error an unrelated option does not establish internal visibility.
const unrelatedVisibility: Material3Options<Material3ColorMode, "internal"> = {
  variant: "expressive",
};
// @ts-expect-error an unrelated option does not establish either fact.
const unrelatedBoth: Material3Options<"custom", "internal"> = { variant: "expressive" };
// @ts-expect-error a single built-in mode still requires an explicit map.
const absentLight: Material3Options<"light"> = {};
// @ts-expect-error the default pair plus a custom name is not the default complete set.
const absentLargerSet: Material3Options<Material3ColorMode | "custom"> = {};
// @ts-expect-error never cannot use omission to bypass the empty-map guard.
const absentNever: Material3Options<never> = {};
void [
  absentModes,
  absentVisibility,
  absentBoth,
  unrelatedModes,
  unrelatedVisibility,
  unrelatedBoth,
  absentLight,
  absentLargerSet,
  absentNever,
];

// Explicit arguments select the supplied-options overload, never runtime defaults.
// @ts-expect-error custom generic requires options.
material3<"custom">("#6750a4");
// @ts-expect-error custom generic requires a modes map, not undefined.
material3<"custom">("#6750a4", undefined);
// @ts-expect-error internal generic requires supplied visibility.
material3<Material3ColorMode, "internal">("#6750a4");
// @ts-expect-error undefined does not establish internal visibility.
material3<Material3ColorMode, "internal">("#6750a4", undefined);
// @ts-expect-error neither narrowed fact can come from omitted options.
material3<"custom", "internal">("#6750a4");
// @ts-expect-error neither narrowed fact can come from undefined options.
material3<"custom", "internal">("#6750a4", undefined);
// @ts-expect-error omission generates both built-in modes.
material3<"light">("#6750a4");
// @ts-expect-error never cannot claim an invariant default layer.
material3<never>("#6750a4");
// @ts-expect-error undefined cannot claim an invariant default layer.
material3<never>("#6750a4", undefined);
// @ts-expect-error an empty options object does not establish a non-empty map.
material3<never>("#6750a4", {});
// @ts-expect-error an explicitly empty modes map is still invalid.
material3<never>("#6750a4", { modeSettings: {} });
// @ts-expect-error an unrelated option does not establish either generic claim.
material3<"custom", "internal">("#6750a4", { variant: "expressive" });
// @ts-expect-error supplying visibility alone cannot establish custom modes.
material3<"custom", "internal">("#6750a4", { visibility: "internal" });
// @ts-expect-error supplying modes alone cannot establish internal visibility.
material3<"custom", "internal">("#6750a4", { modeSettings: { custom: { colorMode: "light" } } });

const undefinedDefaults = material3("#6750a4", undefined);
const annotatedDefaults: Material3Options<Material3ColorMode, "public"> = {};
const annotatedDefaultLayer = material3("#6750a4", annotatedDefaults);
const explicitDefaults = material3<Material3ColorMode, "public">("#6750a4", {});
const explicitCustom = material3<"custom", "internal">("#6750a4", {
  modeSettings: { custom: { colorMode: "light" } },
  visibility: "internal",
});
export type OmittedSettingsProof = Expect<Equal<typeof undefinedDefaults, typeof defaults>>;
export type AnnotatedDefaultsProof = Expect<Equal<typeof annotatedDefaultLayer, typeof defaults>>;
export type ExplicitDefaultsProof = Expect<Equal<typeof explicitDefaults, typeof defaults>>;
export type ExplicitCustomProof = Expect<
  Equal<typeof explicitCustom, MaterialLayer<"custom", "internal">>
>;

// Optional options must be narrowed or defaulted before forwarding.
function optionalBare(options?: Material3Options) {
  // @ts-expect-error possibly undefined input does not select a supplied-settings contract.
  material3("#6750a4", options);
  return material3("#6750a4", options ?? {});
}
function optionalCustom(options?: Material3Options<"custom", "internal">) {
  // @ts-expect-error the absent branch generates light/dark and public.
  material3("#6750a4", options);
  if (options === undefined) {
    return material3("#6750a4");
  }
  return material3("#6750a4", options);
}
function defaultedBare(options: Material3Options = {}) {
  return material3("#6750a4", options);
}
// @ts-expect-error a narrowed wrapper cannot default its required settings to {}.
function invalidModeWrapper(options: Material3Options<"custom"> = {}) {
  return material3("#6750a4", options);
}
// @ts-expect-error a narrowed wrapper cannot default internal visibility to {}.
function invalidVisibilityWrapper(options: Material3Options<Material3ColorMode, "internal"> = {}) {
  return material3("#6750a4", options);
}
// @ts-expect-error both required settings are absent in the wrapper default.
function invalidBothWrapper(options: Material3Options<"custom", "internal"> = {}) {
  return material3("#6750a4", options);
}
function defaultedCustom(
  options: Material3Options<"custom", "internal"> = {
    modeSettings: { custom: { colorMode: "dark" } },
    visibility: "internal",
  },
) {
  return material3("#6750a4", options);
}
export type OptionalBareProof = Expect<
  Equal<ReturnType<typeof optionalBare>, MaterialLayer<Material3ColorMode, TokenVisibility>>
>;
export type DefaultedBareProof = Expect<
  Equal<ReturnType<typeof defaultedBare>, MaterialLayer<Material3ColorMode, TokenVisibility>>
>;
export type OptionalCustomProof = Expect<
  Equal<
    ReturnType<typeof optionalCustom>,
    MaterialLayer<Material3ColorMode, "public"> | MaterialLayer<"custom", "internal">
  >
>;
export type DefaultedCustomProof = Expect<
  Equal<ReturnType<typeof defaultedCustom>, MaterialLayer<"custom", "internal">>
>;
void [invalidModeWrapper, invalidVisibilityWrapper, invalidBothWrapper];

declare const optionalSettings: {
  readonly modeSettings?: Material3ModeSettings<"custom">;
  readonly visibility?: "internal";
};
// @ts-expect-error optional fields cannot promise custom generation or internal visibility.
material3("#6750a4", optionalSettings);
declare const optionalCustomModes: { readonly modeSettings?: Material3ModeSettings<"custom"> };
// @ts-expect-error an optional custom map can fall back to a different complete mode set.
material3("#6750a4", optionalCustomModes);
declare const optionalInternalVisibility: { readonly visibility?: "internal" };
// @ts-expect-error an optional internal field does not establish internal visibility.
material3("#6750a4", optionalInternalVisibility);
const maybeInternal = material3("#6750a4", {
  visibility: optionalInternalVisibility.visibility ?? "public",
});
export type OptionalVisibilityProof = Expect<
  Equal<typeof maybeInternal, MaterialLayer<Material3ColorMode, TokenVisibility>>
>;
defineTokenGraph({
  modes: ["custom"],
  defaultMode: "custom",
  // @ts-expect-error annotated default settings still generate the default complete mode set.
  layers: [annotatedDefaultLayer],
  tokens: {},
});
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
  modeSettings: { light: {}, dark: {} },
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
} as const satisfies Material3ModeSettings<CompilerMode>;
const six = material3("#6750a4", { modeSettings: materialModes, visibility: "internal" });
export type SixModeProof = Expect<Equal<typeof six, MaterialLayer<CompilerMode, "internal">>>;

function forward<Mode extends string, Visibility extends TokenVisibility>(
  options: Material3Options<Mode, Visibility>,
) {
  return material3("#6750a4", options);
}
const wrapped = forward({ modeSettings: materialModes, visibility: "internal" });
export type WrapperProof = Expect<Equal<typeof wrapped, MaterialLayer<CompilerMode, "internal">>>;
const wrapperOptions = {
  modeSettings: materialModes,
  visibility: "internal",
} satisfies Material3Options<CompilerMode, "internal">;
export type WrapperOptionsProof = Expect<
  Equal<
    typeof forward<CompilerMode, "internal">,
    (options: Material3Options<CompilerMode, "internal">) => MaterialLayer<CompilerMode, "internal">
  >
>;
void wrapperOptions;

const one = material3("#6750a4", { modeSettings: { standard: { colorMode: "light" } } });
export type OneModeProof = Expect<Equal<typeof one, MaterialLayer<"standard", "public">>>;
const concat = material3("#6750a4", { modeSettings: { concat: { colorMode: "dark" } } });
export type ConcatModeProof = Expect<Equal<typeof concat, MaterialLayer<"concat", "public">>>;
material3("#6750a4", { modeSettings: { light: { sourceColor: "#009489" } } });
material3("#6750a4", { modeSettings: { dark: {} } });

// @ts-expect-error missing mode in an exact checked map.
const missing = { light: {} } satisfies Material3ModeSettings<Material3ColorMode>;
const extra = {
  light: {},
  dark: {},
  // @ts-expect-error extra mode in an exact checked map.
  dim: { colorMode: "dark" },
} satisfies Material3ModeSettings<Material3ColorMode>;
// @ts-expect-error an empty inline map must not fabricate an invariant layer.
material3("#6750a4", { modeSettings: {} });
// @ts-expect-error an annotated empty map is rejected by the named diagnostic marker.
const empty: Material3ModeSettings<never> = {};
// @ts-expect-error satisfies must reject the same empty map.
const emptyChecked = {} satisfies Material3ModeSettings<never>;
void [missing, extra, empty, emptyChecked];

// @ts-expect-error custom mode requires colorMode.
material3("#6750a4", { modeSettings: { custom: { contrastLevel: 1 } } });
// @ts-expect-error concat is a custom mode requiring colorMode.
material3("#6750a4", { modeSettings: { concat: {} } });
// @ts-expect-error invalid colorMode.
material3("#6750a4", { modeSettings: { custom: { colorMode: "dim" } } });
// Congruent explicit built-in settings are accepted.
material3("#6750a4", { modeSettings: { light: { colorMode: "light" } } });
// Both built-in names may state their inferred color mode.
material3("#6750a4", { modeSettings: { dark: { colorMode: "dark" } } });
// @ts-expect-error no string shorthand.
material3("#6750a4", { modeSettings: { custom: "light" } });
// @ts-expect-error positional source is the only global source.
material3("#6750a4", { sourceColor: "#ff0000" });
// @ts-expect-error removed exactModes.
material3("#6750a4", { exactModes: { light: {} } });
// @ts-expect-error the graph owns defaultMode.
material3("#6750a4", { defaultMode: "light" });
// @ts-expect-error removed appearance in settings.
material3("#6750a4", { modeSettings: { custom: { colorMode: "light", appearance: "light" } } });
// @ts-expect-error no global appearance.
material3("#6750a4", { appearance: "light" });
// @ts-expect-error specVersion stays global.
material3("#6750a4", { modeSettings: { dark: { specVersion: "2025" } } });
// @ts-expect-error visibility stays global.
material3("#6750a4", { modeSettings: { dark: { visibility: "internal" } } });
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

// The supplied-options overload needs the same contextual inference protection.
// @ts-expect-error an empty options object supplies no custom modes.
const fabricatedOptions: TokenLayer<Material3TokenKey, CompilerMode> = material3("#6750a4", {});
function fabricatedOptionsReturn(): TokenLayer<Material3TokenKey, CompilerMode> {
  // @ts-expect-error return context cannot supply modes through the generic overload.
  return material3("#6750a4", {});
}
const fabricatedOptionsList: readonly TokenLayer<string, CompilerMode>[] = [
  // @ts-expect-error typed-list context cannot supply modes through the generic overload.
  material3("#6750a4", {}),
];
// @ts-expect-error context cannot turn absent visibility in an options object into internal.
const fabricatedOptionsVisibility: MaterialLayer<Material3ColorMode, "internal"> = material3(
  "#6750a4",
  {},
);
void [
  fabricatedOptions,
  fabricatedOptionsReturn,
  fabricatedOptionsList,
  fabricatedOptionsVisibility,
];

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
  layers: [material3("#6750a4", { modeSettings: { light: {}, dark: {} } })],
  tokens: {},
});

declare const dynamicModes: Material3ModeSettings<string>;
const dynamic = material3("#6750a4", { modeSettings: dynamicModes });
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
const annotatedPublicOutput = orThrow(
  compileTokenGraph(
    defineTokenGraph({
      modes: ["light", "dark"],
      defaultMode: "light",
      layers: [annotatedDefaultLayer],
      tokens: { alias: tokenRef("md.sys.color.primary") },
    }),
  ),
);
export type AnnotatedPublicProof = Expect<
  Equal<typeof annotatedPublicOutput.tokens, typeof publicOutput.tokens>
>;
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
const uncertainAll = orThrow(compileTokenGraph(uncertainGraph, { selection: "all" }));
export type UncertainAllProof = Expect<
  Equal<typeof uncertainAll.tokens, typeof publicOutput.tokens>
>;
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
  compileTokenGraph(uncertainGraph, { selection: ["md.sys.color.primary"] }),
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

// @ts-expect-error built-in light cannot generate dark colors.
material3("#6750a4", { modeSettings: { light: { colorMode: "dark" } } });
// @ts-expect-error built-in dark cannot generate light colors.
material3("#6750a4", { modeSettings: { dark: { colorMode: "light" } } });
// @ts-expect-error old Material spelling is removed, without a fallback.
material3("#6750a4", { modes: { light: {} } });
const uniformSettings = {
  light: { colorMode: "light" },
  dark: { colorMode: "dark" },
} as const satisfies Material3ModeSettings<Material3ColorMode>;
const uniformLayer = material3("#6750a4", { modeSettings: uniformSettings });
export type UniformSettingsProof = Expect<Equal<typeof uniformLayer, typeof defaults>>;
