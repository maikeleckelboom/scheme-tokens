const SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isIdentifierSegment(input: string): boolean {
  return SEGMENT_PATTERN.test(input);
}

export function isTokenKey(input: string): boolean {
  return input.split(".").every((segment) => isIdentifierSegment(segment));
}

export function isSingleSegmentIdentifier(input: string): boolean {
  return isIdentifierSegment(input) && !input.includes(".");
}

export function isExtensionKey(input: string): boolean {
  const segments = input.split(".");
  return segments.length >= 2 && segments.every((segment) => isIdentifierSegment(segment));
}

export function isClassPrefix(input: string): boolean {
  if (!input.endsWith("-")) return false;
  const withoutTrailingHyphen = input.slice(0, -1);
  return isIdentifierSegment(withoutTrailingHyphen);
}

export function isDataAttributeName(input: string): boolean {
  return /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(input);
}
