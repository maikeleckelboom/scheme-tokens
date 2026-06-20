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
