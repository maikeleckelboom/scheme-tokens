import type { TokenSource } from "color-scheme-tokens";
import {
  material3Source,
  type Material3ExtendedColorInput,
  type Material3SourceInput,
  type Material3SourceIssue,
} from "../../src";

const extendedColor: Material3ExtendedColorInput = {
  name: "success",
  color: "#2e7d32",
  harmonize: true,
};

const input: Material3SourceInput = {
  sourceColor: "#6750a4",
  defaultVisibility: "internal",
  extendedColors: [extendedColor],
};

const source: TokenSource<Material3SourceIssue> = material3Source(input);
source.id.toUpperCase();

// @ts-expect-error sourceColor is required.
material3Source({});

// @ts-expect-error color is not an alias for sourceColor.
material3Source({ color: "#6750a4" });

// @ts-expect-error seed is not an alias for sourceColor.
material3Source({ seed: "#6750a4" });

// @ts-expect-error source is not an alias for sourceColor.
material3Source({ source: "#6750a4" });

// @ts-expect-error customColors is not an alias for extendedColors.
material3Source({ sourceColor: "#6750a4", customColors: [] });

// @ts-expect-error keyColors is not implemented.
material3Source({ sourceColor: "#6750a4", keyColors: [] });

material3Source({
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

material3Source({
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
