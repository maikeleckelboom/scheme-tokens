import type { ExpressionPart, ExpressionSource } from "./canonical-expression";
import type { TokenGraphIssue } from "../types/diagnostics";

export const MAX_RESOLVED_VALUE_LENGTH = 65_536;

export type ResolutionIssue = Extract<
  TokenGraphIssue,
  { readonly code: "unknown-reference" | "reference-cycle" | "resolved-value-too-long" }
>;

type NodeState =
  | { readonly status: "active"; readonly stackIndex: number }
  | { readonly status: "resolved"; readonly value: string }
  | { readonly status: "failed" };

interface Frame {
  readonly key: string;
  readonly source: ExpressionSource;
  readonly parts: readonly ExpressionPart[];
  readonly values: string[];
  partIndex: number;
  referenceIndex: number;
}

/** One resolver per immutable composed graph; memo identity is the (mode, key) pair. */
export function createExpressionResolver(
  sourceFor: (key: string, mode: string) => ExpressionSource | undefined,
  report: (issue: ResolutionIssue) => void,
): (key: string, mode: string) => string | undefined {
  const modes = new Map<string, Map<string, NodeState>>();
  const cycles = new Set<string>();

  return (key, mode) => {
    let memo = modes.get(mode);
    if (memo === undefined) {
      memo = new Map();
      modes.set(mode, memo);
    }
    const existing = memo.get(key);
    if (existing !== undefined) {
      return existing.status === "resolved" ? existing.value : undefined;
    }
    const source = sourceFor(key, mode);
    if (source === undefined) {
      throw new Error("Resolution roots must have a source expression.");
    }

    const stack: Frame[] = [];
    const start = (nextKey: string, nextSource: ExpressionSource) => {
      const expression = nextSource.expression;
      if (typeof expression === "string") {
        memo.set(nextKey, { status: "resolved", value: expression });
        return;
      }
      // Start only the next dependency, never pre-mark discovered siblings as active.
      memo.set(nextKey, { status: "active", stackIndex: stack.length });
      stack.push({
        key: nextKey,
        source: nextSource,
        parts: "concat" in expression ? expression.concat : [expression],
        values: [],
        partIndex: 0,
        referenceIndex: 0,
      });
    };
    const fail = (frame: Frame, issue?: ResolutionIssue) => {
      memo.set(frame.key, { status: "failed" });
      stack.pop();
      if (issue !== undefined) {
        if (issue.code === "reference-cycle") {
          const identity = JSON.stringify([issue.mode, issue.cycle]);
          if (cycles.has(identity)) {
            return;
          }
          cycles.add(identity);
        }
        report(issue);
      }
    };

    start(key, source);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as Frame;
      const part = frame.parts[frame.partIndex];
      if (part === undefined) {
        const expression = frame.source.expression;
        const value =
          typeof expression === "object" && "concat" in expression
            ? joinResolvedConcat(frame.values)
            : frame.values[0];
        if (value === undefined) {
          fail(frame, {
            code: "resolved-value-too-long",
            message: "Resolved concat exceeds 65,536 UTF-16 code units.",
            key: frame.key,
            mode,
            path: frame.source.path,
          });
        } else {
          memo.set(frame.key, { status: "resolved", value });
          stack.pop();
        }
        continue;
      }
      if (typeof part === "string") {
        frame.values.push(part);
        frame.partIndex += 1;
        continue;
      }

      const dependency = memo.get(part.ref);
      if (dependency === undefined) {
        const nextSource = sourceFor(part.ref, mode);
        if (nextSource !== undefined) {
          start(part.ref, nextSource);
          continue;
        }
      } else if (dependency.status === "resolved") {
        frame.values.push(dependency.value);
        frame.partIndex += 1;
        frame.referenceIndex += 1;
        continue;
      } else if (dependency.status === "failed") {
        // The dependency already reported the source failure. Stop this dependant silently.
        fail(frame);
        continue;
      }

      const context = {
        key: frame.key,
        mode,
        path: frame.source.referencePaths[frame.referenceIndex] ?? frame.source.path,
      };
      fail(
        frame,
        dependency === undefined
          ? {
              ...context,
              code: "unknown-reference",
              message: `Reference target does not exist: ${part.ref}.`,
            }
          : {
              ...context,
              code: "reference-cycle",
              message: `Reference cycle detected for mode ${mode}.`,
              cycle: canonicalCycle(stack.slice(dependency.stackIndex).map((item) => item.key)),
            },
      );
    }
    const resolved = memo.get(key);
    return resolved?.status === "resolved" ? resolved.value : undefined;
  };
}

/** Dependencies are already memoized. Never allocate an oversized resolved concat. */
function joinResolvedConcat(parts: readonly string[]): string | undefined {
  let length = 0;
  for (const part of parts) {
    length += part.length;
    if (length > MAX_RESOLVED_VALUE_LENGTH) {
      return undefined;
    }
  }
  return parts.join("");
}

function canonicalCycle(cycle: readonly string[]): readonly string[] {
  let start = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if ((cycle[index] as string) < (cycle[start] as string)) {
      start = index;
    }
  }
  return [...cycle.slice(start), ...cycle.slice(0, start)];
}
