import type { JsonValue } from "./json";
import type { Issue } from "./result";
import { orThrow } from "./result";
import { isTokenKey, isSingleSegmentIdentifier } from "./identifiers";
import { canonicalizeExpression } from "./canonical-expression";
import { readArray, readPlainRecord } from "./json";
import { normalizeAuthoring } from "./normalize-authoring";
import { validateSourceGraph, validateSourceLayer } from "./validate-source";

export const tokenGraphKind = "scheme-tokens/token-graph";
export const tokenLayerKind = "scheme-tokens/token-layer";
export const compiledSchemeKind = "scheme-tokens/compiled-scheme";

export type TokenVisibility = "public" | "internal";

export interface TokenReference<Key extends string = string> {
  readonly ref: Key;
}

export type TokenExpression<Key extends string = string> =
  | string
  | TokenReference<Key>
  | {
      readonly concat: readonly [string | TokenReference<Key>, ...(string | TokenReference<Key>)[]];
    };

type TokenModeValues<Mode extends string, Key extends string> = Readonly<
  Record<Mode, TokenExpression<Key>>
>;

export interface TokenDefinitionMetadata {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export type TokenDefinition<
  Key extends string = string,
  Mode extends string = string,
> = TokenDefinitionMetadata & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
};

export interface TokenLayer<Key extends string = string, Mode extends string = string> {
  readonly $schema?: string;
  readonly kind: typeof tokenLayerKind;
  readonly formatVersion: 2;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinition<string, Mode>>>;
}

export interface TokenGraph<
  Key extends string = string,
  Mode extends string = string,
  Layers extends readonly TokenLayer<string, string>[] = readonly TokenLayer<string, string>[],
> {
  readonly $schema?: string;
  readonly kind: typeof tokenGraphKind;
  readonly formatVersion: 2;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinition<string, Mode>>>;
  readonly layers?: Layers;
}

type TokenMetadataAuthoring = TokenDefinitionMetadata;

type ExpandedSingleTokenAuthoring<Key extends string> = TokenMetadataAuthoring & {
  readonly value: TokenExpression<Key>;
};

type ExpandedMultiTokenAuthoring<
  Mode extends string,
  Key extends string,
> = TokenMetadataAuthoring & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
};

type SingleTokenAuthoring<Key extends string> =
  | TokenExpression<Key>
  | ExpandedSingleTokenAuthoring<Key>;

type MultiTokenAuthoring<Mode extends string, Key extends string> =
  | TokenExpression<Key>
  | TokenModeValues<Mode, Key>
  | ExpandedMultiTokenAuthoring<Mode, Key>;

type ModeTuple = readonly [string, ...string[]];
type LayerTuple = readonly TokenLayer<string, string>[];
type ReservedMode = "ref" | "value" | "visibility" | "description" | "deprecated" | "extensions";
type ValidModes<Modes extends ModeTuple> =
  Extract<Modes[number], ReservedMode> extends never ? Modes : never;

type LayerMemberKey<Layer> = Layer extends TokenLayer<infer Key, string> ? Key : never;
type LayerKeyOf<Layers extends LayerTuple> = Layers extends readonly []
  ? never
  : LayerMemberKey<Layers[number]>;

type DefinedGraph<
  DirectKey extends string,
  Mode extends string,
  Layers extends LayerTuple,
> = TokenGraph<DirectKey, Mode, Layers>;

interface SharedGraphOptions<Layers extends LayerTuple> {
  readonly defaultVisibility?: TokenVisibility;
  readonly layers?: Layers;
}

type SingleGraphOptions<Layers extends LayerTuple> = SharedGraphOptions<Layers> & {
  readonly modes?: never;
  readonly defaultMode?: never;
};

type MultiGraphOptions<
  Modes extends ModeTuple,
  Layers extends LayerTuple,
> = SharedGraphOptions<Layers> & {
  readonly modes: ValidModes<Modes>;
  readonly defaultMode: NoInfer<Modes[number]>;
};

type SingleGraphAuthoring<
  DirectKey extends string,
  Layers extends LayerTuple,
> = SingleGraphOptions<Layers> & {
  readonly tokens: Readonly<
    Record<DirectKey, SingleTokenAuthoring<NoInfer<DirectKey | LayerKeyOf<Layers>>>>
  >;
};

type MultiGraphAuthoring<
  Modes extends ModeTuple,
  DirectKey extends string,
  Layers extends LayerTuple,
> = MultiGraphOptions<Modes, Layers> & {
  readonly tokens: Readonly<
    Record<
      DirectKey,
      MultiTokenAuthoring<NoInfer<Modes[number]>, NoInfer<DirectKey | LayerKeyOf<Layers>>>
    >
  >;
};

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "layer";
      readonly id: string;
    };

type DirectTokenKeyOf<T> = T extends { readonly tokens: Readonly<Record<infer Key, unknown>> }
  ? Extract<Key, string>
  : never;

export type TokenKeyOf<T> =
  T extends TokenGraph<infer DirectKey, string, infer Layers>
    ? DirectKey | LayerKeyOf<Layers>
    : DirectTokenKeyOf<T>;

export type ModeOf<T> = T extends { readonly modes: readonly [infer First, ...infer Rest] }
  ? Extract<First | Rest[number], string>
  : never;

export type TokenGraphIssue = Issue<
  | "invalid-object"
  | "unknown-property"
  | "missing-property"
  | "invalid-artifact-kind"
  | "invalid-format-version"
  | "invalid-schema-uri"
  | "invalid-json-value"
  | "empty-modes"
  | "invalid-mode-key"
  | "duplicate-mode-key"
  | "default-mode-not-found"
  | "invalid-default-visibility"
  | "layer-mode-mismatch"
  | "resolved-value-too-long"
  | "invalid-layer-id"
  | "duplicate-layer-id"
  | "invalid-token-key"
  | "invalid-visibility"
  | "invalid-token-definition"
  | "missing-token-value"
  | "invalid-token-value"
  | "missing-mode-value"
  | "unknown-mode-value"
  | "invalid-reference"
  | "unknown-reference"
  | "reference-cycle"
  | "invalid-description"
  | "invalid-deprecated"
  | "invalid-extensions"
> & {
  readonly key?: string;
  readonly mode?: string;
  readonly layerId?: string;
  readonly firstPath?: string;
  readonly cycle?: readonly string[];
  readonly modes?: readonly string[];
  readonly layerModes?: readonly string[];
};

export function tokenRef<const Key extends string>(key: Key): TokenReference<Key> {
  if (typeof key !== "string" || !isTokenKey(key)) {
    return orThrow({
      ok: false,
      issues: [{ code: "invalid-reference", message: "Reference key must be a valid token key." }],
    });
  }
  return { ref: key };
}

export function tokenConcat<const Key extends string>(
  strings: TemplateStringsArray,
  ...references: readonly TokenReference<Key>[]
): TokenExpression<Key> {
  const literals = orThrow(
    readArray(strings, {
      code: "invalid-token-value",
      message: "Invalid tagged template arguments.",
    }),
  );
  if (
    literals.length !== references.length + 1 ||
    literals.some((part) => typeof part.value !== "string")
  ) {
    return orThrow({
      ok: false,
      issues: [{ code: "invalid-token-value", message: "Invalid tagged template arguments." }],
    });
  }
  const parts: unknown[] = [];
  for (const { index, value } of literals) {
    parts.push(value);
    if (index < references.length) {
      const record = orThrow(
        readPlainRecord(references[index], {
          code: "invalid-reference",
          message: "Template substitutions must be references.",
          path: "/" + index,
        }),
      );
      if (record.length !== 1 || record[0]?.key !== "ref") {
        return orThrow({
          ok: false,
          issues: [
            {
              code: "invalid-reference",
              message: "Template substitutions must be references.",
              path: "/" + index,
            },
          ],
        });
      }
      const reference = orThrow(canonicalizeExpression(references[index], "/" + index)).expression;
      if (typeof reference !== "object" || !("ref" in reference)) {
        return orThrow({
          ok: false,
          issues: [
            {
              code: "invalid-reference",
              message: "Template substitutions must be references.",
              path: "/" + index,
            },
          ],
        });
      }
      parts.push(reference);
    }
  }
  return orThrow(canonicalizeExpression({ concat: parts }, "")).expression as TokenExpression<Key>;
}

export function defineTokenGraph<
  const DirectKey extends string,
  const Layers extends LayerTuple = readonly [],
>(input: SingleGraphAuthoring<DirectKey, Layers>): DefinedGraph<DirectKey, "base", Layers>;
export function defineTokenGraph<
  const Modes extends ModeTuple,
  const DirectKey extends string,
  const Layers extends LayerTuple = readonly [],
>(
  input: MultiGraphAuthoring<Modes, DirectKey, Layers>,
): DefinedGraph<DirectKey, Modes[number], Layers>;
export function defineTokenGraph(input: unknown): TokenGraph {
  const normalized = orThrow(normalizeAuthoring(input, "graph"));
  return orThrow(validateSourceGraph(normalized.input, { paths: normalized.paths })).artifact;
}

export function defineTokenLayer<const Key extends string>(input: {
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Readonly<Record<Key, MultiTokenAuthoring<string, string>>>;
}): TokenLayer<Key, string>;
export function defineTokenLayer(input: unknown): TokenLayer {
  const normalized = orThrow(normalizeAuthoring(input, "layer"));
  return orThrow(validateSourceLayer(normalized.input, { paths: normalized.paths })).artifact;
}

const reservedModeKeys = new Set([
  "ref",
  "value",
  "visibility",
  "description",
  "deprecated",
  "extensions",
]);
export function isModeKey(input: string): boolean {
  return isSingleSegmentIdentifier(input) && !reservedModeKeys.has(input);
}
