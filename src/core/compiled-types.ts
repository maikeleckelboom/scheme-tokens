import type { ColorValue, ParseColorIssue } from "./color";
import type {
  ColorTokenGraphIssue,
  CompiledColorSchemeKind,
  TokenOrigin,
  TokenVisibility,
} from "./graph";
import type { JsonValue } from "./json";
import type { Issue, Result } from "./result";

export type TokenSelection<Key extends string = string> =
  | "public"
  | "all"
  | {
      readonly keys: readonly Key[];
    };

export interface CompileTokenGraphOptions<Key extends string = string> {
  readonly selection?: TokenSelection<Key>;
}

export type CompileTokenGraphIssue = Issue<
  | "invalid-compile-options"
  | "invalid-selection"
  | "empty-selection"
  | "invalid-selection-key"
  | "duplicate-selection-key"
  | "unknown-selection-key"
  | "no-selected-tokens"
> & {
  readonly key?: string;
};

export interface CompiledColorToken<Mode extends string = string> {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<Mode, ColorValue>>;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<Mode, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledColorScheme<Key extends string = string, Mode extends string = string> {
  readonly kind: CompiledColorSchemeKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, CompiledColorToken<Mode>>>;
}

export type ParseCompiledSchemeIssue =
  | ParseColorIssue
  | (Issue<
      | "invalid-object"
      | "unknown-property"
      | "missing-property"
      | "invalid-artifact-kind"
      | "invalid-format-version"
      | "invalid-mode-key"
      | "duplicate-mode-key"
      | "default-mode-not-found"
      | "invalid-token-key"
      | "invalid-visibility"
      | "invalid-token-definition"
      | "missing-mode-value"
      | "unknown-mode-value"
      | "invalid-origin"
      | "invalid-dependencies"
      | "invalid-description"
      | "invalid-deprecated"
      | "invalid-extensions"
      | "invalid-json-value"
    > & {
      readonly key?: string;
      readonly mode?: string;
    });

export type CompileTokenGraphResult<
  Key extends string = string,
  Mode extends string = string,
> = Result<CompiledColorScheme<Key, Mode>, ColorTokenGraphIssue | CompileTokenGraphIssue>;
