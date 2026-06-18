import type { ParseResult } from "./graph";

declare const tokenKeyBrand: unique symbol;

export type TokenKey = string & { readonly [tokenKeyBrand]: "TokenKey" };

export interface TokenKeyProblem {
  readonly kind: "invalid-token-key";
  readonly input: string;
  readonly message: string;
}

export type TokenKeyResult = ParseResult<TokenKey, TokenKeyProblem>;

const TOKEN_SEGMENT_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export function parseTokenKey(input: string): TokenKeyResult {
  const segments = input.split(".");
  const valid =
    input.length > 0 &&
    segments.length >= 2 &&
    segments.every((segment) => TOKEN_SEGMENT_PATTERN.test(segment));

  if (valid) {
    return { ok: true, value: input as TokenKey };
  }

  return {
    ok: false,
    problem: {
      kind: "invalid-token-key",
      input,
      message:
        "Token keys must contain at least two dot-separated segments, and each segment must start with a lowercase ASCII letter.",
    },
  };
}

export function tokenKey(input: string): TokenKey {
  const result = parseTokenKey(input);
  if (result.ok) return result.value;
  throw new Error(result.problem.message);
}
