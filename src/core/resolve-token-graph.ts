import type { ComposedGraph } from "./compose-token-graph";
import { defineRecordValue, sortedRecord } from "./json";
import { IssueCollector, type Result } from "./result";
import { createExpressionResolver, type ResolutionIssue } from "./resolve-expressions";

/** Resolve the complete key space before selection. Memoization belongs to this invocation. */
export function resolveTokenGraph(
  graph: ComposedGraph,
): Result<Readonly<Record<string, Readonly<Record<string, string>>>>, ResolutionIssue> {
  const collector = new IssueCollector<ResolutionIssue>();
  const resolve = createExpressionResolver(
    (key, mode) => graph.tokens[key]?.expressions[mode],
    (issue) => collector.add(issue),
  );
  const tokens: Record<string, Readonly<Record<string, string>>> = {};
  for (const key of Object.keys(graph.tokens)) {
    const values: Record<string, string> = {};
    for (const mode of graph.modes) {
      const value = resolve(key, mode);
      if (value !== undefined) {
        defineRecordValue(values, mode, value);
      }
    }
    defineRecordValue(tokens, key, sortedRecord(Object.entries(values)));
  }
  return collector.result(tokens);
}
