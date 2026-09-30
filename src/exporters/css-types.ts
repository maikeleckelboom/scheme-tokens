import type { ParseCompiledSchemeIssue } from "../core/compiled-types";
import type { Issue } from "../core/result";

/** A custom activation condition: an author selector, optionally inside a media condition. */
export interface CssCondition {
  readonly selector: string;
  readonly media?: string;
}

export interface CssVariableNameInput<Key extends string = string> {
  readonly tokenKey: Key;
  readonly segments: readonly [string, ...string[]];
  readonly defaultName: string;
  readonly prefix?: string;
}

export interface ExportCssVarsOptions<Key extends string = string, Mode extends string = string> {
  /** Lower-kebab segment placed after `--` in every default variable name. */
  readonly prefix?: string;
  /** Replace a default variable name; results pass the same safety and collision checks. */
  readonly variableName?: (input: CssVariableNameInput<Key>) => string;
  readonly format?: "pretty" | "compact";
  /** Element that receives the default mode and system conditions. Defaults to `:root`. */
  readonly root?: string;
  /**
   * `data-*` attribute whose value selects a mode on any element. Omitted, it is `data-theme`
   * when the scheme has more than one mode; `false` disables generated markers.
   */
  readonly attribute?: string | false;
  /** Media condition that activates a mode at `root`. No mode is inferred. */
  readonly system?: Readonly<Partial<Record<Mode, string>>>;
  /** Custom conditions per mode: one selector, or a list of selectors with optional media. */
  readonly selectors?: Readonly<
    Partial<Record<Mode, string | readonly [CssCondition, ...CssCondition[]]>>
  >;
  /** Wrap the output in `@layer <name>`. */
  readonly cascadeLayer?: string;
}

export type CssActivationTier = "base" | "system" | "explicit" | "custom";

export interface CssVarDeclaration<Key extends string = string> {
  readonly tokenKey: Key;
  readonly property: string;
  readonly value: string;
}

/**
 * One mode's complete declarations under one activation condition. The emitted rule is
 * `:where(<selectors joined by ", ">)`, inside `@media <media>` when `media` is present.
 */
export interface CssVarBlock<Key extends string = string, Mode extends string = string> {
  readonly tier: CssActivationTier;
  readonly mode: Mode;
  readonly selectors: readonly [string, ...string[]];
  readonly media?: string;
  readonly declarations: readonly CssVarDeclaration<Key>[];
}

type CssVariableMap<Key extends string, Complete extends boolean> = Complete extends true
  ? Readonly<Record<Key, string>>
  : Readonly<Partial<Record<Key, string>>>;

export interface CssVarsExport<
  Key extends string = string,
  Mode extends string = string,
  Complete extends boolean = true,
> {
  readonly css: string;
  readonly blocks: readonly CssVarBlock<Key, Mode>[];
  readonly variableByToken: CssVariableMap<Key, Complete>;
}

export type ExportCssVarsIssue =
  | ParseCompiledSchemeIssue
  | (Issue<
      | "invalid-css-options"
      | "invalid-css-prefix"
      | "invalid-css-variable"
      | "invalid-css-value"
      | "duplicate-css-variable"
      | "invalid-root"
      | "invalid-attribute"
      | "invalid-selector"
      | "invalid-media"
      | "invalid-custom-condition"
      | "unknown-condition-mode"
      | "invalid-cascade-layer"
    > & {
      readonly option?: string;
      readonly key?: string;
      readonly firstKey?: string;
      readonly mode?: string;
      readonly tier?: "system" | "custom";
      readonly index?: number;
      readonly property?: string;
      readonly selector?: string;
      readonly media?: string;
    });
