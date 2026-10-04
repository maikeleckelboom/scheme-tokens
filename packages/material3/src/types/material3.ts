import type { TokenVisibility } from "scheme-tokens";
import type { material3RoleDefinitions } from "../role-catalog";

export type Material3ColorMode = "light" | "dark";
export type Material3SpecVersion = "2021" | "2025";
export type Material3Variant =
  | "monochrome"
  | "neutral"
  | "tonal-spot"
  | "vibrant"
  | "expressive"
  | "fidelity"
  | "content"
  | "rainbow"
  | "fruit-salad";

export type Material3TokenKey = (typeof material3RoleDefinitions)[number]["tokenKey"];

interface Material3ModeOverrides {
  readonly sourceColor?: string;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
}

type Material3SettingsForMode<Mode extends string> = Mode extends Material3ColorMode
  ? Material3ModeOverrides & { readonly colorMode?: Mode }
  : Material3ModeOverrides & { readonly colorMode: Material3ColorMode };

interface Material3ModeSettingsMustNotBeEmpty {
  readonly material3ModeSettingsMustNotBeEmpty: never;
}

/** One settings entry per graph mode; the graph owns its envelope and order. */
export type Material3ModeSettings<Mode extends string> = {
  readonly [M in Mode]: Material3SettingsForMode<M>;
} & ([Mode] extends [never] ? Material3ModeSettingsMustNotBeEmpty : unknown);

/** Non-default facts require the settings that establish them at runtime. */
export type Material3Options<
  Mode extends string = Material3ColorMode,
  Visibility extends TokenVisibility = TokenVisibility,
> = {
  readonly specVersion?: Material3SpecVersion;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
  readonly visibility?: Visibility;
  readonly modeSettings?: Material3ModeSettings<Mode>;
} & ([NoInfer<Mode>, Material3ColorMode] extends [Material3ColorMode, NoInfer<Mode>]
  ? unknown
  : { readonly modeSettings: Material3ModeSettings<NoInfer<Mode>> }) &
  ("public" extends NoInfer<Visibility> ? unknown : { readonly visibility: NoInfer<Visibility> });
