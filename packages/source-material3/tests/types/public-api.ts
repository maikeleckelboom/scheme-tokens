import type { TokenSource } from "color-scheme-tokens";
import { material3Source, type Material3SourceInput, type Material3SourceIssue } from "../../src";

const input: Material3SourceInput = {
  sourceColor: "#6750a4",
  defaultVisibility: "internal",
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
