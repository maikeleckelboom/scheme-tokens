import type {
  TokenDefinitionMetadata,
  TokenExpression,
  TokenLayer,
  TokenConcat,
  TokenModeValues,
  TokenReference,
  TokenVisibility,
} from "./graph";

/** Diagnostic marker: this property is not part of a token definition. */
interface UnknownTokenProperty<Name extends PropertyKey> {
  readonly unknownTokenProperty: Name;
}

/** Diagnostic marker: this mode is not in the mode set the value must use. */
interface UnknownMode<Name extends PropertyKey> {
  readonly unknownMode: Name;
}

/** Diagnostic marker: a layer's mode maps name a different set than the graph declares. */
interface LayerModeMismatch<LayerModes extends string, GraphModes extends string> {
  readonly layerModes: LayerModes;
  readonly graphModes: GraphModes;
}

/** Diagnostic marker: not a lower-kebab mode identifier, or a reserved token property. */
interface InvalidModeName<Name extends string> {
  readonly invalidModeName: Name;
}

export type ModeTuple = readonly [string, ...string[]];

type LowerLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type ReservedMode = "ref" | "value" | "visibility" | "description" | "deprecated" | "extensions";

/** A literal member; `string` and template patterns are dynamic and checked at runtime. */
type IsLiteral<Name extends PropertyKey> = {} extends Record<Name, 0> ? false : true;

/** Every member is a literal, so the union is a finite known set. */
export type IsFinite<Names extends string> = false extends (
  Names extends unknown ? IsLiteral<Names> : never
)
  ? false
  : true;

// Mirrors `isModeKey`: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/ and not a reserved property.
type IsModeName<Name extends string> = Name extends ReservedMode
  ? false
  : Name extends `${LowerLetter}${infer Rest}`
    ? IsModeTail<Rest>
    : false;
type IsModeTail<Rest extends string> = Rest extends ""
  ? true
  : Rest extends `-${LowerLetter | Digit}${infer Next}`
    ? IsModeTail<Next>
    : Rest extends `${LowerLetter | Digit}${infer Next}`
      ? IsModeTail<Next>
      : false;
type IsAcceptedModeName<Name extends string> =
  IsLiteral<Name> extends true ? IsModeName<Name> : true;

/** Literal mode names that the runtime grammar accepts; dynamic names pass through. */
export type AcceptedModeNames<Mode extends string> = Mode extends unknown
  ? IsAcceptedModeName<Mode> extends true
    ? Mode
    : never
  : never;

export type CheckModeNames<Modes> = Modes extends ModeTuple
  ? {
      readonly [Index in keyof Modes]: Modes[Index] extends string
        ? IsAcceptedModeName<Modes[Index]> extends true
          ? Modes[Index]
          : InvalidModeName<Modes[Index]>
        : Modes[Index];
    }
  : Modes;

export type GraphModes<Modes> = Modes extends ModeTuple ? Modes[number] : "base";

type DefinitionKey = "value" | "visibility" | "description" | "deprecated" | "extensions";

/**
 * ADR 0015 classification of one value: a string, an exact `{ ref }`, or an exact
 * `{ concat }` whose value is an array. Property presence alone never decides it.
 */
type IsExpression<Value> = Value extends string
  ? true
  : Value extends object
    ? string extends keyof Value
      ? false
      : [keyof Value] extends ["ref"]
        ? Value extends { readonly ref: unknown }
          ? true
          : false
        : [keyof Value] extends ["concat"]
          ? Value extends { readonly concat: readonly unknown[] }
            ? true
            : false
          : false
    : false;

type IsExactReference<Value> = [keyof Value] extends ["ref"] ? true : false;
type HasExactParts<Parts> = false extends (
  Parts extends unknown ? (Parts extends string ? true : IsExactReference<Parts>) : never
)
  ? false
  : true;

// Validation runs for every authored token, so it classifies each member once by its exact
// key set and exits early for the common shapes. Only invalid input reaches `Expected*`.
type IsValidConcat<Value, Key extends string> =
  Value extends TokenConcat<Key> ? HasExactParts<Value["concat"][number]> : false;

/** One member in expression position: a string, an exact reference, or an exact concat. */
type IsValidExpression<Value, Key extends string> = Value extends string
  ? true
  : Value extends object
    ? [keyof Value] extends ["ref"]
      ? Value extends TokenReference<Key>
        ? true
        : false
      : [keyof Value] extends ["concat"]
        ? IsValidConcat<Value, Key>
        : false
    : false;

/** Every union member is an expression that targets a known key. */
type AreValidExpressions<Value, Key extends string> = false extends (
  Value extends unknown ? IsValidExpression<Value, Key> : never
)
  ? false
  : true;

type AreValidModeValues<Value, Key extends string> = Value[keyof Value] extends string
  ? true
  : false extends {
        readonly [Mode in keyof Value]-?: AreValidExpressions<Value[Mode], Key>;
      }[keyof Value]
    ? false
    : true;

type IsValidModeMap<Value, Key extends string, Mode extends string> = string extends Mode
  ? AreValidModeValues<Value, Key>
  : [Exclude<keyof Value, Mode>] extends [never]
    ? [Exclude<Mode, keyof Value>] extends [never]
      ? AreValidModeValues<Value, Key>
      : false
    : false;

/** One member in value position: an expression, or a total mode map of expressions. */
type IsValidValueMember<Value, Key extends string, Mode extends string> = Value extends string
  ? true
  : Value extends object
    ? string extends keyof Value
      ? AreValidExpressions<Value[keyof Value], Key>
      : [keyof Value] extends ["ref"]
        ? Value extends TokenReference<Key>
          ? true
          : false
        : [keyof Value] extends ["concat"]
          ? Value extends { readonly concat: readonly unknown[] }
            ? IsValidConcat<Value, Key>
            : IsValidModeMap<Value, Key, Mode>
          : IsValidModeMap<Value, Key, Mode>
    : false;

type AreValidValues<Value, Key extends string, Mode extends string> = false extends (
  Value extends unknown ? IsValidValueMember<Value, Key, Mode> : never
)
  ? false
  : true;

type IsDefinition<Value> = Value extends object
  ? string extends keyof Value
    ? false
    : [Extract<keyof Value, DefinitionKey>] extends [never]
      ? false
      : true
  : false;

type IsValidDefinition<Value, Key extends string, Mode extends string> = [
  Exclude<keyof Value, DefinitionKey>,
] extends [never]
  ? Value extends TokenDefinitionMetadata & { readonly value: infer Inner }
    ? AreValidValues<Inner, Key, Mode>
    : false
  : false;

type ForbidModes<Value, Mode extends string> = {
  readonly [Name in Exclude<keyof Value, Mode>]: UnknownMode<Name>;
};
type ForbidProperties<Value> = {
  readonly [Name in Exclude<keyof Value, DefinitionKey>]: UnknownTokenProperty<Name>;
};

type AnyValue<Key extends string, Mode extends string> =
  | TokenExpression<Key>
  | TokenModeValues<Mode, Key>;
type ObjectExpression<Key extends string> = Exclude<TokenExpression<Key>, string>;

// The constraint is checked by assignability, which ignores extra properties, so the
// expected shape of an expression record names every extra property with a marker.
type ForbidExtra<Value, Allowed extends PropertyKey> = {
  readonly [Name in Exclude<keyof Value, Allowed>]: UnknownTokenProperty<Name>;
};
type ExpectedReference<Value, Key extends string> =
  IsExactReference<Value> extends true
    ? TokenReference<Key>
    : TokenReference<Key> & ForbidExtra<Value, "ref">;
type ExpectedParts<Parts extends readonly unknown[], Key extends string> = Parts extends readonly []
  ? ObjectExpression<Key>
  : {
      readonly [Index in keyof Parts]: Parts[Index] extends string
        ? string
        : Parts[Index] extends object
          ? ExpectedReference<Parts[Index], Key>
          : string | TokenReference<Key>;
    };
type ExpectedExpression<Value, Key extends string> = Value extends unknown
  ? Value extends string
    ? string
    : Value extends object
      ? "ref" extends keyof Value
        ? ExpectedReference<Value, Key>
        : Value extends { readonly concat: infer Parts extends readonly unknown[] }
          ? { readonly concat: ExpectedParts<Parts, Key> } & ForbidExtra<Value, "concat">
          : ObjectExpression<Key>
      : TokenExpression<Key>
  : never;

type ExpectedModeMap<Value, Key extends string, Mode extends string> = string extends Mode
  ? { readonly [Name in keyof Value]: ExpectedExpression<Value[Name], Key> }
  : {
      readonly [Name in Mode]: Name extends keyof Value
        ? ExpectedExpression<Value[Name], Key>
        : TokenExpression<Key>;
    } & ForbidModes<Value, Mode>;

/** The precise shape an invalid value must have, so the diagnostic lands on its property. */
type ExpectedValue<Value, Key extends string, Mode extends string> = Value extends unknown
  ? IsExpression<Value> extends true
    ? ExpectedExpression<Value, Key>
    : Value extends object
      ? string extends keyof Value
        ? { readonly [name: string]: TokenExpression<Key> }
        : [keyof Value] extends [never]
          ? AnyValue<Key, Mode>
          : ExpectedModeMap<Value, Key, Mode>
      : AnyValue<Key, Mode>
  : never;

type ExpectedDefinition<
  Value,
  Key extends string,
  Mode extends string,
> = TokenDefinitionMetadata & {
  readonly value: "value" extends keyof Value
    ? ExpectedValue<Value["value" & keyof Value], Key, Mode>
    : AnyValue<Key, Mode>;
} & ForbidProperties<Value>;

type IsValidToken<Value, Key extends string, Mode extends string> = Value extends string
  ? true
  : IsDefinition<Value> extends true
    ? IsValidDefinition<Value, Key, Mode>
    : IsValidValueMember<Value, Key, Mode>;

/**
 * Validate one captured token value against the reference universe and mode set. A valid
 * member is returned unchanged; an invalid one maps to the shape it should have had.
 */
type CheckToken<Value, Key extends string, Mode extends string> = Value extends unknown
  ? IsValidToken<Value, Key, Mode> extends true
    ? Value
    : IsDefinition<Value> extends true
      ? ExpectedDefinition<Value, Key, Mode>
      : ExpectedValue<Value, Key, Mode>
  : never;

type AreValidTokens<Tokens, Key extends string, Mode extends string> = [Tokens] extends [
  Required<Tokens>,
]
  ? false extends {
      readonly [Name in keyof Tokens]-?: IsValidToken<Tokens[Name], Key, Mode>;
    }[keyof Tokens]
    ? false
    : true
  : false;

/**
 * The strict constraint for a captured token record (ADR 0013 D4). Valid input meets
 * `unknown`, so contextual typing never expands the expected shapes; invalid input is
 * checked against them, and the diagnostic lands on the offending property. A key that
 * may be absent has no known definition and is rejected.
 */
export type TokensConstraint<Tokens, Key extends string, Mode extends string> =
  AreValidTokens<Tokens, Key, Mode> extends true
    ? unknown
    : { readonly [Name in keyof Tokens]-?: CheckToken<Tokens[Name], Key, Mode> };

// D12: a layer's mode set is the union of the names its mode maps use.
type ValueModes<Value> = Value extends unknown
  ? IsExpression<Value> extends true
    ? never
    : Value extends object
      ? string extends keyof Value
        ? string
        : Extract<keyof Value, string>
      : never
  : never;
type EntryModes<Value> = Value extends unknown
  ? IsDefinition<Value> extends true
    ? ValueModes<Value["value" & keyof Value]>
    : ValueModes<Value>
  : never;
/** Index with `[keyof Tokens]` at the use site, so the mode set prints as its members. */
export type LayerModeEntries<Tokens> = {
  readonly [Key in keyof Tokens]-?: EntryModes<Tokens[Key]>;
};

type LayerModeOf<Layer> = Layer extends TokenLayer<string, infer Mode> ? Mode : string;
type SameSet<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type CheckLayer<Layer, GraphMode extends string> = [LayerModeOf<Layer>] extends [never]
  ? Layer
  : IsFinite<LayerModeOf<Layer> | GraphMode> extends false
    ? Layer
    : SameSet<LayerModeOf<Layer>, GraphMode> extends true
      ? Layer
      : LayerModeMismatch<LayerModeOf<Layer>, GraphMode>;
export type CheckLayers<Layers extends readonly unknown[], GraphMode extends string> = {
  readonly [Index in keyof Layers]: CheckLayer<Layers[Index], GraphMode>;
};

export type DefaultModeInput<Modes> = Modes extends ModeTuple
  ? { readonly defaultMode: NoInfer<Modes[number]> }
  : { readonly defaultMode?: never };

/** What one declaration may state: an explicit visibility, or none (ADR 0011). */
type DeclaredState = TokenVisibility | "omitted";

// Every state a declaration may have. A record with an index signature may hold any of them.
type DeclaredStates<Value> = Value extends unknown
  ? Value extends object
    ? string extends keyof Value
      ? DeclaredState
      : "visibility" extends keyof Value
        ? Value extends { readonly visibility: unknown }
          ? Extract<Value["visibility" & keyof Value], TokenVisibility>
          : Extract<Value["visibility" & keyof Value], TokenVisibility> | "omitted"
        : "omitted"
    : "omitted"
  : never;

/** Keys whose declaration may have this state. */
export type DeclaredStateKeys<Tokens, State extends DeclaredState> = {
  readonly [Key in keyof Tokens]-?: State extends DeclaredStates<Tokens[Key]> ? Key : never;
}[keyof Tokens] &
  string;
