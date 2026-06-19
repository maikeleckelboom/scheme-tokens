import type { ColorInput } from "./colorValue";
import type { ColorTokenValue } from "./colorTokenValue";
import type { TokenKey, TokenKeyInput } from "./keys";
import type { ModeKey, ModeKeyInput } from "./modes";
import type { TokenProvenance } from "./provenance";

export type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problems: readonly Problem[] };

export type ParseResult<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problem: Problem };

export interface ModeValueInput<Value> {
  readonly mode: ModeKeyInput;
  readonly value: Value;
}

export type ModeValuesInput<Value> = readonly ModeValueInput<Value>[];

export interface ModeValue<Value> {
  readonly mode: ModeKey;
  readonly value: Value;
}

export type ModeValues<Value> = readonly ModeValue<Value>[];

export type ColorSchemeTokenModeValueInput = ModeValueInput<ColorInput>;

export type ColorSchemeTokenModeValue = ModeValue<ColorTokenValue>;

export interface ColorTokenNodeInput {
  readonly kind: "color";
  readonly key: TokenKeyInput;
  readonly values: readonly ColorSchemeTokenModeValueInput[];
  readonly provenance?: TokenProvenance;
}

export interface ColorTokenNode {
  readonly kind: "color";
  readonly key: TokenKey;
  readonly values: readonly ColorSchemeTokenModeValue[];
  readonly provenance?: TokenProvenance;
}

export interface AliasTokenNodeInput {
  readonly kind: "alias";
  readonly key: TokenKeyInput;
  readonly target: TokenKeyInput | ModeValuesInput<TokenKeyInput>;
  readonly provenance?: TokenProvenance;
}

export interface AliasTokenNode {
  readonly kind: "alias";
  readonly key: TokenKey;
  readonly target: TokenKey | ModeValues<TokenKey>;
  readonly provenance?: TokenProvenance;
}

export type TokenNodeInput = ColorTokenNodeInput | AliasTokenNodeInput;

export type TokenNode = ColorTokenNode | AliasTokenNode;

export interface ColorSchemeTokenGraphInput {
  readonly schemaVersion: "color-scheme-token-graph/v0";
  readonly modes: readonly ModeKeyInput[];
  readonly tokens: readonly TokenNodeInput[];
}

export interface ValidatedColorSchemeTokenGraph {
  readonly schemaVersion: "color-scheme-token-graph/v0";
  readonly modes: readonly ModeKey[];
  readonly tokens: readonly TokenNode[];
}

export type ColorSchemeTokenGraph = ValidatedColorSchemeTokenGraph;
