import type { ColorInput, ColorValue, ParseColorIssue } from "./color";
import type { Issue, Result } from "./result";
import type { JsonValue } from "./json";

export type TokenVisibility = "public" | "internal";

export interface ReferenceInput {
  readonly ref: string;
}

export type ColorExpressionInput = ColorInput | ReferenceInput;
export type ColorExpression = ColorValue | ReferenceInput;

export type TokenDefinitionInput<Mode extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: ColorExpressionInput;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput>>;
    }
);

export interface TokenFragmentInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
}

export interface TokenGraphInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
  readonly fragments?: readonly TokenFragmentInput<Mode>[];
}

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "fragment";
      readonly id: string;
    }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };

export interface TokenGraphToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorExpression>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface TokenGraph {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, TokenGraphToken>>;
}

export type TokenGraphIssue =
  | ParseColorIssue
  | (Issue<
      | "invalid-object"
      | "unknown-property"
      | "missing-property"
      | "invalid-format-version"
      | "invalid-schema-uri"
      | "invalid-json-value"
      | "empty-modes"
      | "invalid-mode-key"
      | "duplicate-mode-key"
      | "default-mode-not-found"
      | "invalid-default-visibility"
      | "invalid-fragment-id"
      | "duplicate-fragment-id"
      | "invalid-token-key"
      | "duplicate-token-key"
      | "invalid-visibility"
      | "invalid-token-definition"
      | "missing-token-value"
      | "conflicting-token-value"
      | "missing-mode-value"
      | "unknown-mode-value"
      | "invalid-reference"
      | "unknown-reference"
      | "reference-cycle"
      | "invalid-description"
      | "invalid-deprecated"
      | "invalid-extensions"
      | "invalid-extension-key"
      | "issue-limit-reached"
    > & {
      readonly key?: string;
      readonly mode?: string;
      readonly fragmentId?: string;
      readonly firstPath?: string;
      readonly cycle?: readonly string[];
    });

export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<Record<string, TokenDefinitionInput<NoInfer<Modes[number]>>>>,
  const Fragments extends readonly TokenFragmentInput<NoInfer<Modes[number]>>[] | undefined =
    undefined,
>(input: {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
  readonly fragments?: Fragments;
}): {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
} & (Fragments extends undefined ? Record<never, never> : { readonly fragments: Fragments }) {
  return input as {
    readonly $schema?: string;
    readonly formatVersion: 1;
    readonly modes: Modes;
    readonly defaultMode: Modes[number];
    readonly defaultVisibility: TokenVisibility;
    readonly tokens: Tokens;
  } & (Fragments extends undefined ? Record<never, never> : { readonly fragments: Fragments });
}

export function defineTokenFragment<
  const Mode extends string = string,
  const Tokens extends Readonly<Record<string, TokenDefinitionInput<Mode>>> = Readonly<
    Record<string, TokenDefinitionInput<Mode>>
  >,
>(input: {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
}): {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Tokens;
} {
  return input;
}

export function isReferenceInput(input: unknown): input is ReferenceInput {
  return input !== null && typeof input === "object" && "ref" in input;
}

export type ParseTokenGraphResult = Result<TokenGraph, TokenGraphIssue>;
