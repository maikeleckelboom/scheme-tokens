const MAX_SELECTOR_LENGTH = 256;
const MAX_SELECTOR_NESTING = 8;

// Functional pseudo-classes and the argument each accepts. `:host()` takes one compound
// selector; the others take a selector list. Every other pseudo-class is outside the grammar.
const SELECTOR_LIST_PSEUDO_CLASSES = new Set(["is", "not", "where"]);

/**
 * Whether `selector` belongs to the exporter's bounded selector grammar: type, universal,
 * class, id, and attribute selectors, `:root`, `:host`, `:host(<compound>)`, and
 * `:is()`/`:not()`/`:where()` over selector lists, joined by combinators and commas.
 */
export function isValidCssSelector(selector: string): boolean {
  if (
    selector.length === 0 ||
    selector.length > MAX_SELECTOR_LENGTH ||
    selector.trim() !== selector ||
    hasControlCharacters(selector) ||
    /[{};@\\]/u.test(selector) ||
    selector.includes("/*") ||
    selector.includes("*/")
  ) {
    return false;
  }

  return new SafeSelectorParser(selector).parse();
}

export function isSafeCssDeclarationValue(value: string): boolean {
  if (hasControlCharacters(value) || value.includes("/*") || value.includes("*/")) {
    return false;
  }

  const delimiters: string[] = [];
  let quote: '"' | "'" | undefined;
  let outsideQuotes = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;

    if (quote !== undefined) {
      if (character === "\\") {
        index += 1;
        if (index >= value.length) {
          return false;
        }
        continue;
      }
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      outsideQuotes += " ";
      continue;
    }
    if (character === "\\" || character === ";" || character === "{" || character === "}") {
      return false;
    }
    if (character === "(" || character === "[") {
      delimiters.push(character === "(" ? ")" : "]");
    } else if (character === ")" || character === "]") {
      if (delimiters.pop() !== character) {
        return false;
      }
    }
    outsideQuotes += character;
  }

  return (
    quote === undefined &&
    delimiters.length === 0 &&
    !/! *important(?:[^A-Za-z0-9_-]|$)/iu.test(outsideQuotes)
  );
}

export function hasControlCharacters(input: string): boolean {
  for (const character of input) {
    const codePoint = character.codePointAt(0) as number;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    ) {
      return true;
    }
  }
  return false;
}

/**
 * A recursive-descent recognizer. Every branch consumes input before it recurses, and
 * functional pseudo-classes are bounded by `MAX_SELECTOR_NESTING`, so validation is linear in
 * the (already bounded) selector length.
 */
class SafeSelectorParser {
  readonly #selector: string;
  #index = 0;
  #depth = 0;

  constructor(selector: string) {
    this.#selector = selector;
  }

  parse(): boolean {
    return this.#parseSelectorList() && this.#index === this.#selector.length;
  }

  #parseSelectorList(): boolean {
    if (!this.#parseComplexSelector()) {
      return false;
    }
    while (this.#selector[this.#index] === ",") {
      this.#index += 1;
      this.#skipSpaces();
      if (!this.#parseComplexSelector()) {
        return false;
      }
    }
    return true;
  }

  #parseComplexSelector(): boolean {
    if (!this.#parseCompoundSelector()) {
      return false;
    }

    while (this.#index < this.#selector.length) {
      const hadSpaces = this.#skipSpaces();
      const character = this.#selector[this.#index];
      if (character === undefined || character === "," || character === ")") {
        return true;
      }

      if (character === ">" || character === "+" || character === "~") {
        this.#index += 1;
        this.#skipSpaces();
        if (!this.#parseCompoundSelector()) {
          return false;
        }
        continue;
      }

      if (!hadSpaces || !this.#parseCompoundSelector()) {
        return false;
      }
    }

    return true;
  }

  #parseCompoundSelector(): boolean {
    let foundComponent = false;

    if (this.#selector[this.#index] === "*") {
      this.#index += 1;
      foundComponent = true;
    } else if (this.#readIdentifier()) {
      foundComponent = true;
    }

    while (this.#index < this.#selector.length) {
      const character = this.#selector[this.#index];
      if (character === "." || character === "#") {
        this.#index += 1;
        if (!this.#readIdentifier()) {
          return false;
        }
      } else if (character === "[") {
        if (!this.#parseAttributeSelector()) {
          return false;
        }
      } else if (character === ":") {
        if (!this.#parsePseudoClass()) {
          return false;
        }
      } else {
        break;
      }
      foundComponent = true;
    }

    return foundComponent;
  }

  #parsePseudoClass(): boolean {
    this.#index += 1;
    const start = this.#index;
    while (/[a-z]/u.test(this.#selector[this.#index] ?? "")) {
      this.#index += 1;
    }
    const name = this.#selector.slice(start, this.#index);
    const functional = this.#selector[this.#index] === "(";

    if (!functional) {
      return name === "root" || name === "host";
    }
    if (name !== "host" && !SELECTOR_LIST_PSEUDO_CLASSES.has(name)) {
      return false;
    }
    if (this.#depth >= MAX_SELECTOR_NESTING) {
      return false;
    }

    this.#index += 1;
    this.#depth += 1;
    this.#skipSpaces();
    const parsedArgument =
      name === "host" ? this.#parseCompoundSelector() : this.#parseSelectorList();
    this.#skipSpaces();
    this.#depth -= 1;
    if (!parsedArgument || this.#selector[this.#index] !== ")") {
      return false;
    }
    this.#index += 1;
    return true;
  }

  #parseAttributeSelector(): boolean {
    this.#index += 1;
    this.#skipSpaces();
    if (!this.#readAttributeName()) {
      return false;
    }
    this.#skipSpaces();

    if (this.#selector[this.#index] === "]") {
      this.#index += 1;
      return true;
    }
    if (!this.#readAttributeOperator()) {
      return false;
    }
    this.#skipSpaces();
    if (!this.#readAttributeValue()) {
      return false;
    }

    const hadSpaces = this.#skipSpaces();
    if (hadSpaces && /[iIsS]/u.test(this.#selector[this.#index] ?? "")) {
      this.#index += 1;
      this.#skipSpaces();
    }
    if (this.#selector[this.#index] !== "]") {
      return false;
    }
    this.#index += 1;
    return true;
  }

  #readAttributeName(): boolean {
    if (!isNameStart(this.#selector[this.#index])) {
      return false;
    }
    this.#index += 1;
    while (isNameCharacter(this.#selector[this.#index])) {
      this.#index += 1;
    }
    return true;
  }

  #readAttributeOperator(): boolean {
    const character = this.#selector[this.#index];
    if (character === "=") {
      this.#index += 1;
      return true;
    }
    if (
      (character === "~" ||
        character === "|" ||
        character === "^" ||
        character === "$" ||
        character === "*") &&
      this.#selector[this.#index + 1] === "="
    ) {
      this.#index += 2;
      return true;
    }
    return false;
  }

  #readAttributeValue(): boolean {
    const character = this.#selector[this.#index];
    if (character === '"' || character === "'") {
      this.#index += 1;
      while (this.#index < this.#selector.length) {
        if (this.#selector[this.#index] === character) {
          this.#index += 1;
          return true;
        }
        this.#index += 1;
      }
      return false;
    }

    const start = this.#index;
    while (isNameCharacter(this.#selector[this.#index])) {
      this.#index += 1;
    }
    return this.#index > start;
  }

  #readIdentifier(): boolean {
    const start = this.#index;
    if (this.#selector[this.#index] === "-") {
      this.#index += 1;
    }
    if (!isNameStart(this.#selector[this.#index])) {
      this.#index = start;
      return false;
    }
    this.#index += 1;
    while (isNameCharacter(this.#selector[this.#index])) {
      this.#index += 1;
    }
    return true;
  }

  #skipSpaces(): boolean {
    const start = this.#index;
    while (this.#selector[this.#index] === " ") {
      this.#index += 1;
    }
    return this.#index > start;
  }
}

function isNameStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Z_a-z]/u.test(character);
}

function isNameCharacter(character: string | undefined): boolean {
  return character !== undefined && /[-0-9A-Z_a-z]/u.test(character);
}
