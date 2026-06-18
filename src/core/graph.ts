import type { ColorTokenValue } from "./colorTokenValue";
import type { TokenKey } from "./keys";
import type { ModeKey } from "./modes";
import type { TokenProvenance } from "./provenance";

export type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problems: readonly Problem[] };

export type ParseResult<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problem: Problem };

export interface ModeValue<Value> {
  readonly mode: ModeKey;
  readonly value: Value;
}

export type ModeValues<Value> = readonly ModeValue<Value>[];

export interface ColorTokenNode {
  readonly kind: "color";
  readonly key: TokenKey;
  readonly values: ModeValues<ColorTokenValue>;
  readonly provenance?: TokenProvenance;
}

export interface AliasTokenNode {
  readonly kind: "alias";
  readonly key: TokenKey;
  readonly target: TokenKey | ModeValues<TokenKey>;
  readonly provenance?: TokenProvenance;
}

export type TokenNode = ColorTokenNode | AliasTokenNode;

export interface ColorSchemeTokenGraph {
  readonly schemaVersion: "color-scheme-token-graph/v0";
  readonly modes: readonly ModeKey[];
  readonly tokens: readonly TokenNode[];
}
