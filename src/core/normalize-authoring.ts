import { tokenGraphKind, tokenLayerKind, type TokenGraphIssue } from "./graph";
import { defineRecordValue, pointer, readPlainRecord } from "./json";
import { IssueCollector, type Result } from "./result";
import { SourcePaths } from "./source-paths";

const metadataKeys = new Set(["value", "visibility", "description", "deprecated", "extensions"]);

/** Expand shorthand only. The source validator owns all semantic rules. */
export function normalizeAuthoring(
  input: unknown,
  kind: "graph" | "layer",
): Result<
  {
    readonly input: unknown;
    readonly paths: SourcePaths;
  },
  TokenGraphIssue
> {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Authoring input must be a plain object.",
  });
  if (!entries.ok) {
    return entries;
  }
  const collector = new IssueCollector<TokenGraphIssue>();
  const allowed = new Set(
    kind === "graph"
      ? ["modes", "defaultMode", "defaultVisibility", "layers", "tokens"]
      : ["id", "defaultVisibility", "tokens"],
  );
  const output: Record<string, unknown> = {};
  for (const entry of entries.value) {
    if (!allowed.has(entry.key)) {
      collector.add({
        code: "unknown-property",
        message: "Unknown authoring property: " + entry.key,
        path: pointer(entry.key),
      });
    }
    defineRecordValue(output, entry.key, entry.value);
  }
  const paths = new SourcePaths();
  const tokens = readPlainRecord(output.tokens, {
    code: "invalid-object",
    message: "tokens must be a plain record.",
    path: "/tokens",
  });
  if (tokens.ok) {
    const definitions: Record<string, unknown> = {};
    for (const entry of tokens.value) {
      const record = readPlainRecord(entry.value, { code: "invalid-token-definition" });
      const expanded = record.ok && record.value.some((part) => metadataKeys.has(part.key));
      defineRecordValue(definitions, entry.key, expanded ? entry.value : { value: entry.value });
      if (!expanded) {
        paths.set(pointer("tokens", entry.key, "value"), pointer("tokens", entry.key));
      }
    }
    output.tokens = definitions;
  }
  output.kind = kind === "graph" ? tokenGraphKind : tokenLayerKind;
  output.formatVersion = 2;
  if (output.defaultVisibility === undefined) {
    output.defaultVisibility = "public";
  }
  if (kind === "graph" && output.modes === undefined) {
    if (output.defaultMode !== undefined) {
      collector.add({
        code: "missing-property",
        message: "defaultMode requires explicit modes.",
        path: "/modes",
      });
    }
    output.modes = ["base"];
    output.defaultMode = "base";
  }
  return collector.result({ input: output, paths });
}
