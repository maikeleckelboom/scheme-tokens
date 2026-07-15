const MAX_SELECTOR_LENGTH = 256;

interface SafeSelectorParse {
  readonly appendSafe: boolean;
  readonly valid: boolean;
}

export function isValidCssSelector(selector: string): boolean {
  return parseSafeSelector(selector).valid;
}

export function isAppendSafeCssSelector(selector: string): boolean {
  const parsed = parseSafeSelector(selector);
  return parsed.valid && parsed.appendSafe;
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

function parseSafeSelector(selector: string): SafeSelectorParse {
  if (
    selector.length === 0 ||
    selector.length > MAX_SELECTOR_LENGTH ||
    selector.trim() !== selector ||
    hasControlCharacters(selector) ||
    /[{};@\\]/u.test(selector) ||
    selector.includes("/*") ||
    selector.includes("*/")
  ) {
    return { appendSafe: false, valid: false };
  }

  const parser = new SafeSelectorParser(selector);
  return parser.parse();
}

class SafeSelectorParser {
  readonly #selector: string;
  #index = 0;
  #sawCombinator = false;
  #sawList = false;

  constructor(selector: string) {
    this.#selector = selector;
  }

  parse(): SafeSelectorParse {
    if (!this.#parseComplexSelector()) {
      return { appendSafe: false, valid: false };
    }

    while (this.#index < this.#selector.length) {
      if (this.#selector[this.#index] !== ",") {
        return { appendSafe: false, valid: false };
      }
      this.#sawList = true;
      this.#index += 1;
      this.#skipSpaces();
      if (!this.#parseComplexSelector()) {
        return { appendSafe: false, valid: false };
      }
    }

    return {
      appendSafe: !this.#sawCombinator && !this.#sawList,
      valid: true,
    };
  }

  #parseComplexSelector(): boolean {
    if (!this.#parseCompoundSelector()) {
      return false;
    }

    while (this.#index < this.#selector.length) {
      const hadSpaces = this.#skipSpaces();
      const character = this.#selector[this.#index];
      if (character === undefined || character === ",") {
        return true;
      }

      if (character === ">" || character === "+" || character === "~") {
        this.#sawCombinator = true;
        this.#index += 1;
        this.#skipSpaces();
        if (!this.#parseCompoundSelector()) {
          return false;
        }
        continue;
      }

      if (!hadSpaces) {
        return false;
      }
      this.#sawCombinator = true;
      if (!this.#parseCompoundSelector()) {
        return false;
      }
    }

    return true;
  }

  #parseCompoundSelector(): boolean {
    let foundComponent = false;

    if (this.#selector.startsWith(":root", this.#index)) {
      this.#index += ":root".length;
      foundComponent = true;
    } else if (this.#selector[this.#index] === "*") {
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
        foundComponent = true;
        continue;
      }
      if (character === "[") {
        if (!this.#parseAttributeSelector()) {
          return false;
        }
        foundComponent = true;
        continue;
      }
      break;
    }

    return foundComponent;
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
    const start = this.#index;
    if (!isNameStart(this.#selector[this.#index])) {
      return false;
    }
    this.#index += 1;
    while (isNameCharacter(this.#selector[this.#index])) {
      this.#index += 1;
    }
    return this.#index > start;
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
    while (isUnquotedAttributeValueCharacter(this.#selector[this.#index])) {
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

function hasControlCharacters(input: string): boolean {
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

function isNameStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Z_a-z]/u.test(character);
}

function isNameCharacter(character: string | undefined): boolean {
  return character !== undefined && /[-0-9A-Z_a-z]/u.test(character);
}

function isUnquotedAttributeValueCharacter(character: string | undefined): boolean {
  return character !== undefined && /[-0-9A-Z_a-z]/u.test(character);
}
