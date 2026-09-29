import type { ExpressionPart, ExpressionSource } from "./canonical-expression";
import type { Issue } from "./result";

export const MAX_RESOLVED_VALUE_LENGTH = 65_536;

export interface ResolutionIssue extends Issue<
  "unknown-reference" | "reference-cycle" | "resolved-value-too-long"
> {
  readonly key: string;
  readonly mode: string;
  readonly path: string;
  readonly cycle?: readonly string[];
}

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

      fail(frame, {
        code: dependency === undefined ? "unknown-reference" : "reference-cycle",
        message:
          dependency === undefined
            ? `Reference target does not exist: ${part.ref}.`
            : `Reference cycle detected for mode ${mode}.`,
        key: frame.key,
        mode,
        path: frame.source.referencePaths[frame.referenceIndex] ?? frame.source.path,
        ...(dependency?.status === "active"
          ? { cycle: stack.slice(dependency.stackIndex).map((item) => item.key) }
          : {}),
      });
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
