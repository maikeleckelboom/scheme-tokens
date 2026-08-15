import type { TokenLayer, TokenVisibility } from "scheme-tokens";
import type { material3RoleDefinitions } from "../role-catalog";

export type Material3Appearance = "light" | "dark";
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

type Material3ModeConfig<Key extends string> = Key extends "light" | "dark"
  ? Material3ModeOverrides & { readonly appearance?: never }
  : Material3ModeOverrides & { readonly appearance: Material3Appearance };

type Material3BuiltInMode = "light" | "dark";

type Material3AdditiveModeMap<Extra extends string> = {
  readonly [Key in Material3BuiltInMode | Extra]?: Material3ModeConfig<Key>;
};

type Material3ExactModeMap<Mode extends string> = {
  readonly [Key in Mode]: Material3ModeConfig<Key>;
};

interface Material3BaseOptions {
  readonly specVersion?: Material3SpecVersion;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
  readonly visibility?: TokenVisibility;
}

export type Material3AdditiveModeOptions<Extra extends string> = Material3BaseOptions & {
  readonly modes?: Material3AdditiveModeMap<Extra>;
  readonly exactModes?: never;
  readonly defaultMode?: NoInfer<Material3BuiltInMode | Extra>;
};

export type Material3ExactModeOptions<Mode extends string> = Material3BaseOptions & {
  readonly modes?: never;
  readonly exactModes: Material3ExactModeMap<Mode>;
  readonly defaultMode: NoInfer<Mode>;
};

export interface Material3GraphFragment<Mode extends string> {
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly layers: readonly [TokenLayer<Material3TokenKey>];
}
