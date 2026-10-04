import type {
  AcceptedModeNames,
  CheckLayers,
  CheckModeNames,
  TokensConstraint,
  DefaultModeInput,
  DeclaredStateKeys,
  GraphModes,
  LayerModeEntries,
  ModeTuple,
} from "./authoring-types";
import type { GraphState, LayerKeyOf, StateKey, StatePublicKey } from "./composition-types";
import type { JsonValue } from "./json";
export type { TokenGraphIssue } from "../types/diagnostics";
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

type TokenConcatPart<Key extends string> = string | TokenReference<Key>;
export type TokenConcat<Key extends string> = {
  readonly concat: readonly [TokenConcatPart<Key>, ...TokenConcatPart<Key>[]];
};

export type TokenExpression<Key extends string = string> =
  | string
  | TokenReference<Key>
  | TokenConcat<Key>;

/** A total mode map; a layer without mode maps (`never`) has none. */
export type TokenModeValues<Mode extends string, Key extends string> = [Mode] extends [never]
  ? never
  : Readonly<Record<Mode, TokenExpression<Key>>>;

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

/**
 * Type-only visibility facts of a layer. The mayStatePublicKeys and mayStateInternalKeys
 * sets name declarations that may state visibility; mayOmitVisibilityKeys may omit
 * it. These may-sets can overlap; a wider type only adds possibilities, so the
 * default `LayerVisibilityFacts` describes a layer whose visibility is not statically known.
 */
export interface LayerVisibilityFacts {
  readonly defaultVisibility: TokenVisibility;
  readonly mayStatePublicKeys: string;
  readonly mayStateInternalKeys: string;
  readonly mayOmitVisibilityKeys: string;
}

declare const layerStatic: unique symbol;
declare const graphStatic: unique symbol;
declare const staticProof: unique symbol;

/**
 * Nominal evidence of a precise static claim. The private member has no runtime counterpart,
 * and an object literal, a spread copy, or a mapped type never has it, so only the helpers'
 * signatures and the values that flow unchanged from them make a precise claim. A classic
 * private member keeps the declarations free of target-gated `#private` syntax; its key is an
 * unexported symbol, so no other code can name it, declare it, or narrow on it with `in`.
 */
declare class StaticProof {
  private [staticProof]: unknown;
}

/**
 * A finite key union is an exact claim: no other finite union is assignable to it, so
 * neither an annotation nor union subtype reduction can add or hide a key. Every claim is
 * still assignable to the dynamic `string` form.
 */
type ExactClaim<Claim extends string> = string extends Claim ? unknown : (claim: Claim) => Claim;

type IsDynamic<Claim extends string> = string extends Claim ? true : false;

// With a bare `string extends Key` check, TypeScript 7 inferred `string` for `Key` from this
// property whenever a graph type was matched structurally, as an intersection is.
type GraphTokens<Key extends string, Mode extends string> =
  IsDynamic<Key> extends true
    ? Readonly<Record<string, TokenDefinition<string, Mode>>>
    : Readonly<Partial<Record<Key, TokenDefinition<string, Mode>>>>;

/** A layer's runtime fields and its static facts. */
interface TokenLayerFields<
  Key extends string,
  Mode extends string,
  Visibility extends LayerVisibilityFacts,
> {
  readonly $schema?: string;
  readonly kind: typeof tokenLayerKind;
  readonly formatVersion: 2;
  readonly id: string;
  readonly defaultVisibility: Visibility["defaultVisibility"];
  readonly tokens: Readonly<Record<Key, TokenDefinition<string, Mode>>>;
  /** Static information only; never present at runtime or in serialized output. */
  readonly [layerStatic]?: {
    readonly mode: Mode;
    readonly visibility: Visibility;
    readonly exactKey: ExactClaim<Key>;
  };
}

/**
 * `Mode` is the layer's derived mode set: `never` without mode maps, a literal union for a
 * literal layer, and `string` when unknown. A claim narrower than the default requires the
 * proof, so only `defineTokenLayer` and the values that flow from it make one. The default
 * claims nothing and needs no proof; its optional member only keeps the name in printed types.
 */
export type TokenLayer<
  Key extends string = string,
  Mode extends string = string,
  Visibility extends LayerVisibilityFacts = LayerVisibilityFacts,
> = TokenLayerFields<Key, Mode, Visibility> &
  ([string, string, LayerVisibilityFacts] extends [Key, Mode, Visibility]
    ? { readonly [layerStatic]?: unknown }
    : StaticProof);

/** A graph's runtime fields and its static facts. */
interface TokenGraphFields<Key extends string, Mode extends string, PublicKey extends string> {
  readonly $schema?: string;
  readonly kind: typeof tokenGraphKind;
  readonly formatVersion: 2;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly layers?: readonly TokenLayer<string, Mode>[];
  /** The graph's own declarations; layer keys appear here only when the graph overrides them. */
  readonly tokens: GraphTokens<Key, Mode>;
  /** Static information only; never present at runtime or in serialized output. */
  readonly [graphStatic]?: {
    readonly key: Key;
    readonly publicKey: PublicKey;
    readonly exactKey: ExactClaim<Key>;
    readonly exactMode: ExactClaim<Mode>;
    readonly exactPublicKey: ExactClaim<PublicKey>;
  };
}

/**
 * `Key` is every composed key, `PublicKey` the effective public keys after layer order and
 * graph-last visibility. Either is `string` when it is not statically known. A claim
 * narrower than the default requires the proof, so only `defineTokenGraph` and the values
 * that flow from it make one. The default claims nothing and needs no proof; its optional
 * member only keeps the name in printed types.
 */
export type TokenGraph<
  Key extends string = string,
  Mode extends string = string,
  PublicKey extends string = string,
> = TokenGraphFields<Key, Mode, PublicKey> &
  ([string, string, string] extends [Key, Mode, PublicKey]
    ? { readonly [graphStatic]?: unknown }
    : StaticProof);

/**
 * What `defineTokenGraph` returns: a `TokenGraph<Key, Mode, PublicKey>` whose own authored
 * keys, `OwnKey`, are definite in `tokens`. A key that only a layer declares is not promised
 * there. The name keeps the result nameable in a consumer's emitted declarations.
 */
export type DefinedTokenGraph<
  Key extends string,
  Mode extends string,
  PublicKey extends string,
  OwnKey extends string,
> = TokenGraph<Key, Mode, PublicKey> & {
  readonly tokens: Readonly<Record<OwnKey, TokenDefinition<string, Mode>>>;
};

/**
 * A layer as data, without static facts. `layers` is constrained by this shape so that the
 * expected type never supplies a mode set to an inline generic layer (ADR 0013 Appendix A).
 */
interface TokenLayerData {
  readonly $schema?: string;
  readonly kind: typeof tokenLayerKind;
  readonly formatVersion: 2;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionMetadata & { readonly value: unknown }>>;
}

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "layer";
      readonly id: string;
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

/** Canonical results (D5): no reference is a string, one may collapse to that reference. */
type TokenConcatResult<References extends readonly TokenReference[]> =
  number extends References["length"]
    ? TokenExpression<References[number]["ref"]>
    : References extends readonly []
      ? string
      : References extends readonly [TokenReference]
        ? TokenReference<References[0]["ref"]> | TokenConcat<References[0]["ref"]>
        : TokenConcat<References[number]["ref"]>;

export function tokenConcat<const References extends readonly TokenReference[]>(
  strings: TemplateStringsArray,
  ...references: References
): TokenConcatResult<References>;
export function tokenConcat(
  strings: TemplateStringsArray,
  ...references: readonly TokenReference[]
): TokenExpression {
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
  return orThrow(canonicalizeExpression({ concat: parts }, "")).expression;
}

/**
 * Define a graph. Literal input infers every composed key, the mode union, and the public
 * keys after layers compose in order and graph tokens compose last. The graph's own keys
 * are definite in `tokens`; a key only a layer declares is not promised there.
 */
export function defineTokenGraph<
  const Tokens extends TokensConstraint<
    Tokens,
    NoInfer<Extract<keyof Tokens, string> | LayerKeyOf<Layers[number]>>,
    NoInfer<GraphModes<Modes>>
  > = {},
  const Modes extends ModeTuple | undefined = undefined,
  const Layers extends readonly TokenLayerData[] = readonly [],
  const Default extends TokenVisibility = "public",
>(
  input: {
    readonly modes?: Modes & CheckModeNames<Modes>;
    readonly defaultVisibility?: Default;
    readonly layers?: Layers & CheckLayers<Layers, NoInfer<GraphModes<Modes>>>;
    readonly tokens?: Tokens;
  } & DefaultModeInput<Modes> &
    ([keyof NoInfer<Tokens>] extends [never] ? unknown : { readonly tokens: Tokens }),
): DefinedTokenGraph<
  StateKey<GraphState<Tokens, Layers, Default>>,
  GraphModes<Modes>,
  StatePublicKey<GraphState<Tokens, Layers, Default>>,
  Extract<keyof Tokens, string>
>;
export function defineTokenGraph(input: unknown): TokenGraph {
  const normalized = orThrow(normalizeAuthoring(input, "graph"));
  return orThrow(validateSourceGraph(normalized.input, { paths: normalized.paths })).artifact;
}

/**
 * Define a reusable layer. Its mode set is the union of its mode-map names, and every mode
 * map must name all of them (D12).
 */
export function defineTokenLayer<
  const Tokens extends TokensConstraint<
    Tokens,
    string,
    NoInfer<AcceptedModeNames<LayerModeEntries<Tokens>[keyof Tokens]>>
  >,
  const Default extends TokenVisibility = "public",
>(input: {
  readonly id: string;
  readonly defaultVisibility?: Default;
  readonly tokens: Tokens;
}): TokenLayer<
  Extract<keyof Tokens, string>,
  LayerModeEntries<Tokens>[keyof Tokens],
  {
    readonly defaultVisibility: Default;
    readonly mayStatePublicKeys: DeclaredStateKeys<Tokens, "public">;
    readonly mayStateInternalKeys: DeclaredStateKeys<Tokens, "internal">;
    readonly mayOmitVisibilityKeys: DeclaredStateKeys<Tokens, "omitted">;
  }
>;
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
