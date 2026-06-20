import type { ColorValue } from "./color";
import type { TokenGraphIssue, TokenOrigin, TokenVisibility } from "./graph";
import type { Issue } from "./result";
import type { JsonValue } from "./json";

export type TokenSelection =
  | "public"
  | "all"
  | {
      readonly keys: readonly string[];
    };

export interface CompileTokenGraphOptions {
  readonly selection?: TokenSelection;
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

export interface CompiledToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorValue>>;
  readonly origin: TokenOrigin;
  readonly dependenciesByMode: Readonly<Record<string, readonly string[]>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledScheme {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, CompiledToken>>;
}

export type CompileTokenGraphResult = import("./result").Result<
  CompiledScheme,
  TokenGraphIssue | CompileTokenGraphIssue
>;
