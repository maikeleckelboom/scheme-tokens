import type { DeclaredStateKeys, IsFinite } from "./authoring-types";
import type { TokenLayer, TokenVisibility } from "./graph";

/**
 * Static mirror of ADR 0011 composition. Each composed key is in exactly one of `public`,
 * `internal`, or `unknown`; `all` is `string` when the key set is not finite and exact.
 */
interface VisibilityState {
  readonly all: string;
  readonly public: string;
  readonly internal: string;
  readonly unknown: string;
}
interface EmptyState extends VisibilityState {
  readonly all: never;
  readonly public: never;
  readonly internal: never;
  readonly unknown: never;
}
interface DynamicState extends VisibilityState {
  readonly all: string;
  readonly public: never;
  readonly internal: never;
  readonly unknown: string;
}

/**
 * One position. A key in exactly one may-set has a known declaration: explicit visibility
 * replaces the prior state, an omitted one keeps it, and a key the position introduces
 * without visibility takes the position default. Any other key becomes unknown.
 */
type Composed<
  State extends VisibilityState,
  Key extends string,
  MayPublic extends string,
  MayInternal extends string,
  MayOmit extends string,
  Default extends TokenVisibility,
  Public extends string = Exclude<MayPublic, MayInternal | MayOmit>,
  Internal extends string = Exclude<MayInternal, MayPublic | MayOmit>,
  Stated extends string = Exclude<Key, Exclude<MayOmit, MayPublic | MayInternal>>,
  Introduced extends string = Exclude<Key, Stated | State["all"]>,
> = {
  readonly all: State["all"] | Key;
  readonly public:
    | Public
    | Exclude<State["public"], Stated>
    | ([Default] extends ["public"] ? Introduced : never);
  readonly internal:
    | Internal
    | Exclude<State["internal"], Stated>
    | ([Default] extends ["internal"] ? Introduced : never);
  readonly unknown:
    | Exclude<Stated, Public | Internal>
    | Exclude<State["unknown"], Public | Internal>
    | (TokenVisibility extends Default ? Introduced : never);
};

type IsUnion<Value, Whole = Value> = Value extends unknown
  ? [Whole] extends [Value]
    ? false
    : true
  : never;

// A layer states only its own keys, so its may-sets are narrowed to them. The default
// `LayerVisibility` then makes exactly that layer's keys unknown, which a later explicit
// visibility can make known again.
type ComposeLayer<State extends VisibilityState, Layer> =
  true extends IsUnion<Layer>
    ? DynamicState
    : Layer extends TokenLayer<infer Key, string, infer Visibility>
      ? Composed<
          State,
          Key,
          Extract<Key, Visibility["public"]>,
          Extract<Key, Visibility["internal"]>,
          Extract<Key, Visibility["omitted"]>,
          Visibility["default"]
        >
      : DynamicState;

type ComposeLayers<
  State extends VisibilityState,
  Layers extends readonly unknown[],
> = Layers extends readonly [infer Head, ...infer Tail]
  ? ComposeLayers<ComposeLayer<State, Head>, Tail>
  : Layers extends readonly []
    ? State
    : DynamicState;

/** A layer without a proven static claim may declare any key. */
export type LayerKeyOf<Layer> = Layer extends TokenLayer<infer Key> ? Key : string;

/** Layers in array order, then the graph's own tokens with the graph default. */
export type GraphState<
  Tokens,
  Layers extends readonly unknown[],
  Default extends TokenVisibility,
> = Composed<
  ComposeLayers<EmptyState, Layers>,
  Extract<keyof Tokens, string>,
  DeclaredStateKeys<Tokens, "public">,
  DeclaredStateKeys<Tokens, "internal">,
  DeclaredStateKeys<Tokens, "omitted">,
  Default
>;

export type StateKey<State extends VisibilityState> = State["all"];

/** A finite, fully known public union; anything uncertain is `string`. */
export type StatePublicKey<State extends VisibilityState> = [State["unknown"]] extends [never]
  ? IsFinite<State["all"]> extends true
    ? State["public"]
    : string
  : string;
