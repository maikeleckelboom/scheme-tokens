import type { TokenReference } from "./graph";
import { isTokenKey } from "./identifiers";
import { readArray, readPlainRecord } from "./json";
import type { Issue, Result } from "./result";

export type ExpressionPart = string | TokenReference;

/** Internal D5 model. The public v1 expression grammar remains unchanged. */
export type CanonicalExpression =
  | ExpressionPart
  | { readonly concat: readonly [ExpressionPart, ExpressionPart, ...ExpressionPart[]] };

export interface ExpressionSource {
  readonly expression: CanonicalExpression;
  readonly path: string;
  /** Original paths in reference occurrence order, preserved across normalization. */
  readonly referencePaths: readonly string[];
}

type InvalidExpression = Issue<"invalid-token-value">;

/** Owns its output; accepts only strings, exact references, and non-empty flat concat. */
export function canonicalizeExpression(
  input: unknown,
  path: string,
): Result<ExpressionSource, InvalidExpression> {
  if (typeof input === "string") {
    return { ok: true, value: { expression: input, path, referencePaths: [] } };
  }
  const record = readPlainRecord(input, invalidExpression(path));
  if (!record.ok) {
    return record;
  }
  const entry = record.value[0];
  if (record.value.length !== 1 || entry === undefined) {
    return { ok: false, issues: [invalidExpression(path)] };
  }
  if (entry.key === "ref" && typeof entry.value === "string" && isTokenKey(entry.value)) {
    return {
      ok: true,
      value: { expression: { ref: entry.value }, path, referencePaths: [path] },
    };
  }
  if (entry.key !== "concat") {
    return { ok: false, issues: [invalidExpression(path)] };
  }
  const parts = readArray(entry.value, invalidExpression(path));
  if (!parts.ok) {
    return parts;
  }
  if (parts.value.length === 0) {
    return { ok: false, issues: [invalidExpression(path)] };
  }

  const output: ExpressionPart[] = [];
  const referencePaths: string[] = [];
  let literals: string[] = [];
  const flushLiterals = () => {
    if (literals.length > 0) {
      output.push(literals.join(""));
      literals = [];
    }
  };
  for (const part of parts.value) {
    if (typeof part.value === "string") {
      if (part.value.length > 0) {
        literals.push(part.value);
      }
      continue;
    }
    const partPath = `${path}/concat/${part.index}`;
    const reference = readPlainRecord(part.value, invalidExpression(partPath));
    if (!reference.ok) {
      return reference;
    }
    const target = reference.value[0];
    if (
      reference.value.length !== 1 ||
      target?.key !== "ref" ||
      typeof target.value !== "string" ||
      !isTokenKey(target.value)
    ) {
      return { ok: false, issues: [invalidExpression(partPath)] };
    }
    flushLiterals();
    output.push({ ref: target.value });
    referencePaths.push(partPath);
  }
  flushLiterals();

  const expression: CanonicalExpression =
    output.length === 0
      ? ""
      : output.length === 1
        ? (output[0] as ExpressionPart)
        : { concat: output as [ExpressionPart, ExpressionPart, ...ExpressionPart[]] };
  return { ok: true, value: { expression, path, referencePaths } };
}

function invalidExpression(path: string): InvalidExpression {
  return {
    code: "invalid-token-value",
    message: "Expected a string, exact reference, or non-empty flat concat.",
    path,
  };
}
