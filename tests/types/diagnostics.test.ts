import type {
  CompileTokenGraphIssue,
  ExportCssVarsIssue,
  ParseCompiledSchemeIssue,
  TokenGraphIssue,
} from "scheme-tokens";
import type { Equal, Expect } from "./type-assertions.js";

// Narrowing must reveal the emitter's guarantees without assertions or optional access.
export function graphDiagnostic(issue: TokenGraphIssue): string {
  switch (issue.code) {
    case "reference-cycle":
      return issue.cycle.join(" -> ") + issue.key + issue.mode + issue.path;
    case "unknown-reference":
    case "resolved-value-too-long":
      return issue.key + issue.mode + issue.path;
    case "inconsistent-layer-modes":
      return (
        issue.key +
        issue.firstPath +
        issue.layerId +
        issue.modes.join() +
        issue.layerModes.join() +
        issue.path
      );
    case "layer-mode-mismatch":
      return issue.layerId + issue.modes.join() + issue.layerModes.join() + issue.path;
    case "duplicate-layer-id":
      return issue.layerId + issue.firstPath + issue.path;
    case "invalid-token-key":
      return issue.key + issue.path;
    case "duplicate-mode-key":
    case "default-mode-not-found":
    case "missing-mode-value":
    case "unknown-mode-value":
      return issue.mode + issue.path;
    case "unknown-property":
    case "missing-property":
    case "invalid-artifact-kind":
    case "invalid-format-version":
    case "invalid-schema-uri":
    case "invalid-json-value":
    case "empty-modes":
    case "invalid-mode-key":
    case "invalid-visibility":
    case "invalid-token-definition":
    case "invalid-description":
    case "invalid-deprecated":
    case "invalid-extensions":
    case "invalid-default-visibility":
    case "invalid-layer-id":
    case "missing-token-value":
      return issue.path;
    case "invalid-object":
    case "invalid-token-value":
    case "invalid-reference":
      return issue.message;
    default: {
      const exhaustive: never = issue;
      return exhaustive;
    }
  }
}

export function compilerDiagnostic(issue: CompileTokenGraphIssue): string {
  switch (issue.code) {
    case "unknown-selection-key":
    case "duplicate-selection-key":
      return issue.key + issue.path;
    case "invalid-selection-key":
      return (issue.key ?? "non-string") + issue.path;
    case "invalid-selection":
    case "empty-selection":
      return issue.path;
    case "invalid-compile-options":
    case "no-selected-tokens":
      return issue.message;
    default:
      return graphDiagnostic(issue);
  }
}

export function cssDiagnostic(issue: ExportCssVarsIssue): string {
  switch (issue.code) {
    case "duplicate-css-variable":
      return issue.key + issue.firstKey + issue.property;
    case "invalid-css-variable":
      return issue.key + (issue.property ?? "not returned");
    case "invalid-css-value":
      return issue.key + issue.mode + issue.path;
    case "invalid-selector":
      return issue.mode + issue.tier + (issue.selector ?? "non-string");
    case "invalid-media":
      return issue.mode + issue.tier + (issue.media ?? "non-string");
    case "invalid-selector-condition":
    case "unknown-condition-mode":
      return issue.mode + issue.tier;
    case "invalid-root":
      return issue.selector ?? issue.message;
    case "invalid-css-options":
      return issue.option ?? issue.message;
    case "invalid-css-prefix":
    case "invalid-attribute":
    case "invalid-cascade-layer":
      return issue.message;
    default: {
      const compiled: ParseCompiledSchemeIssue = issue;
      return compiled.message;
    }
  }
}

export type CycleIsRequired = Expect<
  Equal<Extract<TokenGraphIssue, { code: "reference-cycle" }>["cycle"], readonly string[]>
>;
export type InvalidKeyMayBeNonString = Expect<
  Equal<
    Extract<CompileTokenGraphIssue, { code: "invalid-selection-key" }>["key"],
    string | undefined
  >
>;
export type CompiledValueHasMode = Expect<
  Equal<Extract<ParseCompiledSchemeIssue, { code: "invalid-token-value" }>["mode"], string>
>;

declare const cycle: Extract<TokenGraphIssue, { code: "reference-cycle" }>;
// @ts-expect-error resolution issues do not pretend to be layer failures.
void cycle.layerId;
declare const layerMismatch: Extract<TokenGraphIssue, { code: "layer-mode-mismatch" }>;
// @ts-expect-error only inconsistent-layer-modes identifies a conflicting declaration.
void layerMismatch.firstPath;
