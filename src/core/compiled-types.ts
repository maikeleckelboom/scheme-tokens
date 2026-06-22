import type { CompiledSchemeKind, TokenGraphIssue, TokenOrigin, TokenVisibility } from "./graph";
import type { JsonValue } from "./json";
import type { FailureResult, Issue } from "./result";

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

export type CompiledToken<Mode extends string = string> = Readonly<Record<Mode, string>>;

export interface CompiledTokenMetadata<Mode extends string = string> {
  readonly visibility: TokenVisibility;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<Mode, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledScheme<Key extends string = string, Mode extends string = string> {
  readonly kind: CompiledSchemeKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, CompiledToken<Mode>>>;
  readonly metadataByToken: Readonly<Record<Key, CompiledTokenMetadata<Mode>>>;
}

export type ParseCompiledSchemeIssue = Issue<
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
  | "invalid-token-value"
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
};

export type CompileTokenGraphResult<Key extends string = string, Mode extends string = string> =
  | {
      readonly ok: true;
      readonly scheme: CompiledScheme<Key, Mode>;
    }
  | FailureResult<TokenGraphIssue | CompileTokenGraphIssue>;

export type ParseCompiledSchemeResult<Key extends string = string, Mode extends string = string> =
  | {
      readonly ok: true;
      readonly scheme: CompiledScheme<Key, Mode>;
    }
  | FailureResult<ParseCompiledSchemeIssue>;
