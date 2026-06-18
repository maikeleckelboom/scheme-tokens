import type { ColorValue } from "../../core/colorValue";
import type { Result, TokenNode } from "../../core/graph";
import type { ModeKey } from "../../core/modes";

export interface DynamicSchemeValueOptions {
  readonly sourceColor: ColorValue;
  readonly modes: readonly ModeKey[];
}

export interface DynamicSchemeValueProblem {
  readonly kind: "dynamic-source-deferred";
  readonly message: string;
}

export type DynamicSchemeValueResult = Result<readonly TokenNode[], DynamicSchemeValueProblem>;

/**
 * Internal placeholder for the future dynamic-color adapter.
 * It intentionally returns a structured failure instead of defining root API behavior.
 */
export function createDynamicSchemeValues(
  _options: DynamicSchemeValueOptions,
): DynamicSchemeValueResult {
  return {
    ok: false,
    problems: [
      {
        kind: "dynamic-source-deferred",
        message:
          "Dynamic color source wiring is deferred until the upstream adapter can be internalized behind the token graph.",
      },
    ],
  };
}
