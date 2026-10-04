import { compiledSchemeKind, type TokenOrigin, type TokenVisibility } from "./graph";
import type { JsonValue } from "./json";
export type { CompileTokenGraphIssue, ParseCompiledSchemeIssue } from "../types/diagnostics";

export type TokenSelection<Key extends string = string> = "public" | "all" | readonly Key[];

export interface CompileTokenGraphOptions<Key extends string = string> {
  readonly selection?: TokenSelection<Key>;
}

export type CompiledToken<Mode extends string = string> = Readonly<Record<Mode, string>>;

type CompiledRecord<Key extends string, Value, Complete extends boolean> = Complete extends true
  ? Readonly<Record<Key, Value>>
  : Readonly<Partial<Record<Key, Value>>>;

export interface TokenDeclarationRecord {
  readonly origin: TokenOrigin;
  readonly declaredVisibility?: TokenVisibility;
}
export type CompiledReference = { readonly ref: string };
export type CompiledConcatPart = string | { readonly ref: string; readonly value: string };
export type CompiledExpression =
  | CompiledReference
  | { readonly concat: readonly [CompiledConcatPart, ...CompiledConcatPart[]] };

export interface CompiledTokenMetadata<Mode extends string = string> {
  readonly visibility: TokenVisibility;
  readonly declarations: readonly [TokenDeclarationRecord, ...TokenDeclarationRecord[]];
  readonly expressionByMode?: Readonly<Partial<Record<Mode, CompiledExpression>>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface CompiledScheme<
  Key extends string = string,
  Mode extends string = string,
  Complete extends boolean = true,
> {
  readonly $schema?: string;
  readonly kind: typeof compiledSchemeKind;
  readonly formatVersion: 2;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: CompiledRecord<Key, CompiledToken<Mode>, Complete>;
  readonly metadataByToken: CompiledRecord<Key, CompiledTokenMetadata<Mode>, Complete>;
}
