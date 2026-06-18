import type { ParseResult } from "./graph";

declare const modeKeyBrand: unique symbol;

export type ModeKey = string & { readonly [modeKeyBrand]: "ModeKey" };

export interface ModeKeyProblem {
  readonly kind: "invalid-mode-key";
  readonly input: string;
  readonly message: string;
}

export type ModeKeyResult = ParseResult<ModeKey, ModeKeyProblem>;

const MODE_KEY_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export function parseModeKey(input: string): ModeKeyResult {
  if (MODE_KEY_PATTERN.test(input)) {
    return { ok: true, value: input as ModeKey };
  }

  return {
    ok: false,
    problem: {
      kind: "invalid-mode-key",
      input,
      message:
        "Mode keys must start with a lowercase ASCII letter and contain only letters or numbers.",
    },
  };
}

export function modeKey(input: string): ModeKey {
  const result = parseModeKey(input);
  if (result.ok) return result.value;
  throw new Error(result.problem.message);
}

export const lightMode = modeKey("light");
export const darkMode = modeKey("dark");
