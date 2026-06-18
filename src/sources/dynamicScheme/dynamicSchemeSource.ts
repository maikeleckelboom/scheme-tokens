import type { ColorValue } from "../../core/colorValue";
import { createSchemeGraph } from "../../core/graphBuilder";
import type { ColorSchemeTokenGraph, Result } from "../../core/graph";
import { darkMode, lightMode, type ModeKey } from "../../core/modes";
import {
  createDynamicSchemeValues,
  type DynamicSchemeValueProblem,
} from "./createDynamicSchemeValues";

export interface DynamicSchemeSourceOptions {
  readonly sourceColor: ColorValue;
  readonly modes?: readonly ModeKey[];
}

export interface DynamicSchemeSource {
  readonly id: "dynamic-color";
  createGraph(): Result<ColorSchemeTokenGraph, DynamicSchemeValueProblem>;
}

export function dynamicSchemeSource(options: DynamicSchemeSourceOptions): DynamicSchemeSource {
  return {
    id: "dynamic-color",
    createGraph() {
      const modes = [...(options.modes ?? [lightMode, darkMode])];
      const values = createDynamicSchemeValues({ sourceColor: options.sourceColor, modes });

      if (!values.ok) return values;

      return {
        ok: true,
        value: createSchemeGraph({
          modes,
          tokens: values.value,
        }),
      };
    },
  };
}
