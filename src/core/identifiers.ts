const SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TOKEN_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isIdentifierSegment(input: string): boolean {
  return SEGMENT_PATTERN.test(input);
}

export function isTokenKey(input: string): boolean {
  const [first, ...rest] = input.split(".");
  return (
    first !== undefined &&
    isIdentifierSegment(first) &&
    rest.every((segment) => TOKEN_SEGMENT_PATTERN.test(segment))
  );
}

export function isSingleSegmentIdentifier(input: string): boolean {
  return isIdentifierSegment(input) && !input.includes(".");
}

export function isExtensionKey(input: string): boolean {
  const segments = input.split(".");
  return segments.length >= 2 && segments.every((segment) => isIdentifierSegment(segment));
}

export function isDataAttributeName(input: string): boolean {
  return /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input);
}

// CSS Cascade 5 makes a layer rule invalid when any name segment is a CSS-wide keyword.
const CSS_WIDE_KEYWORDS = new Set(["inherit", "initial", "revert", "revert-layer", "unset"]);
const MAX_CASCADE_LAYER_NAME_LENGTH = 128;

/** A dot-separated cascade layer name whose segments are lower-kebab identifiers. */
export function isCascadeLayerName(input: string): boolean {
  return (
    input.length <= MAX_CASCADE_LAYER_NAME_LENGTH &&
    input
      .split(".")
      .every((segment) => isIdentifierSegment(segment) && !CSS_WIDE_KEYWORDS.has(segment))
  );
}
