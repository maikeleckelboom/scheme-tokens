import {
  compiledSchemeKind,
  compiledSchemeSchemaUrl,
  type TokenGraphIssue,
  type TokenOrigin,
  type TokenVisibility,
} from "./graph";
import type { JsonValue } from "./json";
import type { Issue } from "./result";

export type TokenSelection<Key extends string = string> =
  | "public"
  | "all"
  | {
      readonly keys: readonly Key[];
    };

export interface CompileTokenGraphOptions<Key extends string = string> {
  readonly selection?: TokenSelection<Key>;
}

type CompileSelectionIssue = Issue<
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

export type CompileTokenGraphIssue = TokenGraphIssue | CompileSelectionIssue;

export type CompiledToken<Mode extends string = string> = Readonly<Record<Mode, string>>;

type CompiledRecord<Key extends string, Value, Complete extends boolean> = Complete extends true
  ? Readonly<Record<Key, Value>>
  : Readonly<Partial<Record<Key, Value>>>;

export interface CompiledTokenMetadata<Mode extends string = string> {
  readonly visibility: TokenVisibility;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<Mode, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledScheme<
  Key extends string = string,
  Mode extends string = string,
  Complete extends boolean = true,
> {
  readonly $schema?: typeof compiledSchemeSchemaUrl;
  readonly kind: typeof compiledSchemeKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: CompiledRecord<Key, CompiledToken<Mode>, Complete>;
  readonly metadataByToken: CompiledRecord<Key, CompiledTokenMetadata<Mode>, Complete>;
}

export type ParseCompiledSchemeIssue = Issue<
  | "invalid-object"
  | "unknown-property"
  | "missing-property"
  | "invalid-artifact-kind"
  | "invalid-format-version"
  | "invalid-schema-uri"
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
