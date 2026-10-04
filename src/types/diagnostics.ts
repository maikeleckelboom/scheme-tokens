import type { Issue } from "../core/result";

/** Each code is a separate variant, including codes with identical payloads. */
type IssueVariants<Details> = {
  [Code in keyof Details & string]: Issue<Code> & Details[Code];
}[keyof Details & string];

interface LocatedIssue {
  readonly path: string;
}
interface ModeIssue extends LocatedIssue {
  readonly mode: string;
}
interface KeyIssue extends LocatedIssue {
  readonly key: string;
}
interface ResolutionDetails extends KeyIssue {
  readonly mode: string;
}

/** Shared validators emit these same payloads at source and compiled boundaries. */
interface ValidationIssueDetails {
  "invalid-object": {};
  "unknown-property": LocatedIssue & { readonly key?: string };
  "missing-property": LocatedIssue & { readonly key?: string };
  "invalid-artifact-kind": LocatedIssue;
  "invalid-format-version": LocatedIssue;
  "invalid-schema-uri": LocatedIssue;
  "invalid-json-value": LocatedIssue;
  "empty-modes": LocatedIssue;
  "invalid-mode-key": LocatedIssue & { readonly mode?: string };
  "duplicate-mode-key": ModeIssue;
  "default-mode-not-found": ModeIssue;
  "invalid-token-key": KeyIssue;
  "invalid-visibility": LocatedIssue;
  "invalid-token-definition": LocatedIssue;
  "missing-mode-value": ModeIssue;
  "unknown-mode-value": ModeIssue;
  "invalid-description": LocatedIssue;
  "invalid-deprecated": LocatedIssue;
  "invalid-extensions": LocatedIssue;
}

export type ValidationIssue = IssueVariants<ValidationIssueDetails>;

export type TokenGraphIssue =
  | ValidationIssue
  | IssueVariants<{
      "invalid-default-visibility": LocatedIssue;
      "invalid-layer-id": LocatedIssue & { readonly layerId?: string };
      "duplicate-layer-id": LocatedIssue & { readonly layerId: string; readonly firstPath: string };
      "inconsistent-layer-modes": KeyIssue & {
        readonly layerId: string;
        readonly firstPath: string;
        readonly modes: readonly string[];
        readonly layerModes: readonly string[];
      };
      "layer-mode-mismatch": LocatedIssue & {
        readonly layerId: string;
        readonly modes: readonly string[];
        readonly layerModes: readonly string[];
      };
      "missing-token-value": LocatedIssue;
      "invalid-token-value": {};
      "invalid-reference": { readonly mode?: string };
      "unknown-reference": ResolutionDetails;
      "resolved-value-too-long": ResolutionDetails;
      "reference-cycle": ResolutionDetails & { readonly cycle: readonly string[] };
    }>;

export type CompileTokenGraphIssue =
  | TokenGraphIssue
  | IssueVariants<{
      "invalid-compile-options": {};
      "invalid-selection": LocatedIssue;
      "empty-selection": LocatedIssue;
      "invalid-selection-key": LocatedIssue & { readonly key?: string };
      "duplicate-selection-key": KeyIssue;
      "unknown-selection-key": KeyIssue;
      "no-selected-tokens": {};
    }>;

export type ParseCompiledSchemeIssue =
  | ValidationIssue
  | IssueVariants<{
      "invalid-token-value": ModeIssue;
      "invalid-origin": LocatedIssue;
      "invalid-declarations": LocatedIssue;
      "invalid-expression": LocatedIssue;
    }>;

export type ExportCssVarsIssue =
  | ParseCompiledSchemeIssue
  | IssueVariants<{
      "invalid-css-options": { readonly option?: string };
      "invalid-css-prefix": {};
      "invalid-css-variable": { readonly key: string; readonly property?: string };
      "invalid-css-value": ResolutionDetails;
      "duplicate-css-variable": {
        readonly key: string;
        readonly firstKey: string;
        readonly property: string;
      };
      "invalid-root": { readonly selector?: string };
      "invalid-attribute": {};
      "invalid-selector": {
        readonly tier: "selector";
        readonly mode: string;
        readonly index?: number;
        readonly selector?: string;
      };
      "invalid-media": {
        readonly tier: "media" | "selector";
        readonly mode: string;
        readonly index?: number;
        readonly media?: string;
      };
      "invalid-selector-condition": {
        readonly tier: "selector";
        readonly mode: string;
        readonly index?: number;
      };
      "unknown-condition-mode": { readonly tier: "media" | "selector"; readonly mode: string };
      "invalid-cascade-layer": {};
    }>;
