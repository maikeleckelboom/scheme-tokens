import type { ColorValue } from "./colorValue";
import { validateColorValue, type ColorValueProblem } from "./colorValue";

export interface LiteralColorValue {
  readonly kind: "literal";
  readonly value: ColorValue;
}

export type ColorTokenValue = LiteralColorValue;

export interface ColorTokenValueProblem {
  readonly kind: "invalid-color-token-value" | ColorValueProblem["kind"];
  readonly message: string;
  readonly path?: string;
}

export function literalColor(value: ColorValue): LiteralColorValue {
  return { kind: "literal", value };
}

export function resolveColorTokenValue(value: ColorTokenValue): ColorValue {
  return value.value;
}

export function validateColorTokenValue(
  value: ColorTokenValue,
  path?: string,
): readonly ColorTokenValueProblem[] {
  if (value.kind !== "literal") {
    return [
      {
        kind: "invalid-color-token-value",
        message: `${path ?? "colorTokenValue"}.kind must be literal.`,
        ...(path === undefined ? {} : { path: `${path}.kind` }),
      },
    ];
  }

  return validateColorValue(value.value, `${path ?? "colorTokenValue"}.value`);
}
