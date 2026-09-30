import { hasControlCharacters } from "./selector-validation";

const MAX_MEDIA_LENGTH = 256;
const MAX_MEDIA_NESTING = 8;

// The media types Media Queries 4 defines; retired types never match, so they are excluded.
const MEDIA_TYPES = new Set(["all", "print", "screen"]);

// Sticky patterns match at `lastIndex` only, so tokenizing never copies the input.
const WORD_TOKENS = [
  ["number", /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[a-z]+|%)?/uy],
  ["identifier", /-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*/uy],
  ["operator", /<=|>=|<|>|=/uy],
] as const;
const PUNCTUATION: ReadonlyMap<string, "open" | "close" | "colon" | "slash"> = new Map([
  ["(", "open"],
  [")", "close"],
  [":", "colon"],
  ["/", "slash"],
] as const);

/**
 * Whether `media` belongs to the exporter's bounded media-condition grammar: an optional
 * `not`/`only` media type (`all`, `print`, `screen`) optionally followed by `and` conditions, or
 * a condition built from parenthesized features combined with `not`, `and`, or `or`. Features
 * are `(name)`, `(name: value)`, or a range such as `(width >= 48rem)`. Keywords, names, and units
 * are lowercase, tokens are separated by spaces, and comma-separated query lists are excluded.
 */
export function isValidMediaCondition(media: string): boolean {
  if (
    media.length === 0 ||
    media.length > MAX_MEDIA_LENGTH ||
    media.trim() !== media ||
    hasControlCharacters(media)
  ) {
    return false;
  }
  return new MediaConditionParser(media).parse();
}

type Token =
  | { readonly kind: "open" | "close" | "colon" | "slash" | "space" }
  | { readonly kind: "identifier" | "number" | "operator"; readonly text: string };

/**
 * Parses over a flat token list. Every branch consumes a token before it recurses, and
 * parentheses are bounded by `MAX_MEDIA_NESTING`, so validation is linear in the input length.
 */
class MediaConditionParser {
  readonly #tokens: readonly Token[] | undefined;
  #index = 0;
  #depth = 0;

  constructor(media: string) {
    this.#tokens = tokenize(media);
  }

  parse(): boolean {
    if (this.#tokens === undefined) {
      return false;
    }
    return this.#parseMediaQuery() && this.#index === this.#tokens.length;
  }

  #parseMediaQuery(): boolean {
    if (this.#peekKind() === "open" || this.#peekKeyword("not", true)) {
      return this.#parseCondition(true);
    }

    if (this.#peekKeyword("not") || this.#peekKeyword("only")) {
      this.#index += 1;
      if (!this.#consumeSpace()) {
        return false;
      }
    }
    const mediaType = this.#peek();
    if (mediaType?.kind !== "identifier" || !MEDIA_TYPES.has(mediaType.text)) {
      return false;
    }
    this.#index += 1;

    if (this.#index === this.#length()) {
      return true;
    }
    return (
      this.#consumeSpace() &&
      this.#consumeKeyword("and") &&
      this.#consumeSpace() &&
      this.#parseCondition(false)
    );
  }

  #parseCondition(allowOr: boolean): boolean {
    if (this.#peekKeyword("not", true)) {
      this.#index += 2;
      return this.#parseInParens();
    }
    if (!this.#parseInParens()) {
      return false;
    }

    let operator: string | undefined;
    while (this.#peekKind() === "space" && this.#peekKind(1) === "identifier") {
      const keyword = this.#peekText(1);
      if ((keyword !== "and" && keyword !== "or") || (keyword === "or" && !allowOr)) {
        return false;
      }
      if (operator !== undefined && operator !== keyword) {
        return false;
      }
      operator = keyword;
      this.#index += 2;
      if (!this.#consumeSpace() || !this.#parseInParens()) {
        return false;
      }
    }
    return true;
  }

  #parseInParens(): boolean {
    if (this.#peekKind() !== "open" || this.#depth >= MAX_MEDIA_NESTING) {
      return false;
    }
    this.#index += 1;
    this.#depth += 1;
    this.#consumeSpace();

    const parsed =
      this.#peekKind() === "open" || this.#peekKeyword("not", true)
        ? this.#parseCondition(true)
        : this.#parseFeature();

    this.#consumeSpace();
    this.#depth -= 1;
    if (!parsed || this.#peekKind() !== "close") {
      return false;
    }
    this.#index += 1;
    return true;
  }

  #parseFeature(): boolean {
    if (this.#peekKind() === "identifier") {
      this.#index += 1;
      this.#consumeSpace();
      if (this.#peekKind() === "close") {
        return true;
      }
      if (this.#peekKind() === "colon") {
        this.#index += 1;
        this.#consumeSpace();
        return this.#parseValue(true);
      }
      return this.#parseOperator() !== undefined && this.#parseValue(false);
    }

    // `value op name` or `value op name op value`, with both operators pointing the same way.
    if (!this.#parseValue(false)) {
      return false;
    }
    this.#consumeSpace();
    const first = this.#parseOperator();
    if (first === undefined || this.#peekKind() !== "identifier") {
      return false;
    }
    this.#index += 1;
    this.#consumeSpace();
    if (this.#peekKind() === "close") {
      return true;
    }
    const second = this.#parseOperator();
    if (second === undefined || first === "=" || second === "=" || first[0] !== second[0]) {
      return false;
    }
    return this.#parseValue(false);
  }

  #parseOperator(): string | undefined {
    const token = this.#peek();
    if (token?.kind !== "operator") {
      return undefined;
    }
    this.#index += 1;
    this.#consumeSpace();
    return token.text;
  }

  #parseValue(allowIdentifier: boolean): boolean {
    const token = this.#peek();
    if (token?.kind === "identifier") {
      this.#index += 1;
      return allowIdentifier;
    }
    if (token?.kind !== "number") {
      return false;
    }
    this.#index += 1;

    // A ratio such as `16/9` or `16 / 9`.
    const save = this.#index;
    this.#consumeSpace();
    if (this.#peekKind() !== "slash") {
      this.#index = save;
      return true;
    }
    this.#index += 1;
    this.#consumeSpace();
    if (this.#peekKind() !== "number") {
      return false;
    }
    this.#index += 1;
    return true;
  }

  #consumeKeyword(keyword: string): boolean {
    if (!this.#peekKeyword(keyword)) {
      return false;
    }
    this.#index += 1;
    return true;
  }

  #consumeSpace(): boolean {
    if (this.#peekKind() !== "space") {
      return false;
    }
    this.#index += 1;
    return true;
  }

  // `followedByParen` requires `keyword ( … )`, which marks `not` as a condition negation
  // rather than the `not` prefix of a media type.
  #peekKeyword(keyword: string, followedByParen = false): boolean {
    if (this.#peekText() !== keyword) {
      return false;
    }
    return !followedByParen || (this.#peekKind(1) === "space" && this.#peekKind(2) === "open");
  }

  #peek(offset = 0): Token | undefined {
    return this.#tokens?.[this.#index + offset];
  }

  #peekKind(offset = 0): Token["kind"] | undefined {
    return this.#peek(offset)?.kind;
  }

  #peekText(offset = 0): string | undefined {
    const token = this.#peek(offset);
    return token !== undefined && "text" in token ? token.text : undefined;
  }

  #length(): number {
    return this.#tokens?.length ?? 0;
  }
}

function tokenize(media: string): readonly Token[] | undefined {
  const tokens: Token[] = [];
  let index = 0;
  while (index < media.length) {
    const character = media[index] as string;
    if (character === " ") {
      while (media[index] === " ") {
        index += 1;
      }
      tokens.push({ kind: "space" });
      continue;
    }
    const punctuation = PUNCTUATION.get(character);
    if (punctuation !== undefined) {
      tokens.push({ kind: punctuation });
      index += 1;
      continue;
    }

    const token = readWordToken(media, index);
    if (token === undefined) {
      return undefined;
    }
    // Words or numbers without a separator between them, such as `2px3` or `1-a`, form one
    // malformed token in CSS; reject them rather than splitting them.
    const previous = tokens.at(-1);
    if (
      (previous?.kind === "identifier" || previous?.kind === "number") &&
      (token.kind === "identifier" || token.kind === "number")
    ) {
      return undefined;
    }
    tokens.push(token);
    index += token.text.length;
  }
  return tokens;
}

function readWordToken(
  media: string,
  index: number,
): { readonly kind: "identifier" | "number" | "operator"; readonly text: string } | undefined {
  for (const [kind, pattern] of WORD_TOKENS) {
    pattern.lastIndex = index;
    const text = pattern.exec(media)?.[0];
    if (text !== undefined) {
      return { kind, text };
    }
  }
  return undefined;
}
