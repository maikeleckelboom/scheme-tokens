import type { TokenSource } from "scheme-tokens";
import {
  material3,
  type Material3ExtendedColorInput,
  type Material3Input,
  type Material3Issue,
} from "../../src";

const extendedColor: Material3ExtendedColorInput = {
  name: "success",
  color: "#2e7d32",
  harmonize: true,
};

const input: Material3Input = {
  sourceColor: "#6750a4",
  defaultVisibility: "internal",
  extendedColors: [extendedColor],
};

const source: TokenSource<Material3Issue> = material3(input);
source.id.toUpperCase();

// @ts-expect-error sourceColor is required.
material3({});

// @ts-expect-error color is not an alias for sourceColor.
material3({ color: "#6750a4" });

// @ts-expect-error seed is not an alias for sourceColor.
material3({ seed: "#6750a4" });

// @ts-expect-error source is not an alias for sourceColor.
material3({ source: "#6750a4" });

// @ts-expect-error customColors is not an alias for extendedColors.
material3({ sourceColor: "#6750a4", customColors: [] });

// @ts-expect-error keyColors is not implemented.
material3({ sourceColor: "#6750a4", keyColors: [] });

material3({
  sourceColor: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      // @ts-expect-error harmonize must be boolean when provided.
      harmonize: "yes",
    },
  ],
});

material3({
  sourceColor: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      // @ts-expect-error blend is not a public extended color option.
      blend: true,
    },
  ],
});
