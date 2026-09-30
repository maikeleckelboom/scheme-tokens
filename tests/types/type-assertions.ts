import type { CompiledScheme, TokenGraph, TokenLayer } from "scheme-tokens";

export type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
export type Expect<Value extends true> = Value;

export type GraphKeys<Graph> = Graph extends TokenGraph<infer Key extends string> ? Key : never;
export type GraphModes<Graph> =
  Graph extends TokenGraph<string, infer Mode extends string> ? Mode : never;
export type PublicKeys<Graph> =
  Graph extends TokenGraph<string, string, infer PublicKey extends string> ? PublicKey : never;

export type LayerKeys<Layer> = Layer extends TokenLayer<infer Key extends string> ? Key : never;
export type LayerModes<Layer> =
  Layer extends TokenLayer<string, infer Mode extends string> ? Mode : never;

export type IsComplete<Scheme> =
  Scheme extends CompiledScheme<string, string, infer Complete> ? Complete : never;
