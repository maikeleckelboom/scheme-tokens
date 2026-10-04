export type { ExportCssVarsIssue } from "../types/diagnostics";

/** A custom activation condition: an author selector, optionally inside a media condition. */
export interface CssCondition {
  readonly selector: string;
  readonly media?: string;
}

export interface CssVariableNameInput<Key extends string = string> {
  readonly tokenKey: Key;
  readonly segments: readonly [string, ...string[]];
  readonly defaultName: string;
  readonly prefix?: string;
}

/** Attribute markers always target ordinary elements; includeHost adds shadow-host matching. */
export interface CssAttributeActivation {
  readonly name: string;
  readonly includeHost?: boolean;
}

export interface CssActivationOptions<Mode extends string = string> {
  /** Selector receiving the default and media rules. Defaults to `:root`; no targeting side effects. */
  readonly root?: string;
  /** Explicit opt-in to data-* markers for every mode, including the default. */
  readonly attribute?: string | CssAttributeActivation;
  /** Media condition activating a mode at root. No mode or application meaning is inferred. */
  readonly media?: Readonly<Partial<Record<Mode, string>>>;
  /** One selector, one condition object, or a non-empty list in authored condition order. */
  readonly selectors?: Readonly<
    Partial<Record<Mode, string | CssCondition | readonly [CssCondition, ...CssCondition[]]>>
  >;
}

export interface ExportCssVarsOptions<Key extends string = string, Mode extends string = string> {
  /** Lower-kebab segment placed after `--` in every default variable name. */
  readonly prefix?: string;
  /** Replace a default variable name; results pass the same safety and collision checks. */
  readonly variableName?: (input: CssVariableNameInput<Key>) => string;
  readonly format?: "pretty" | "compact";
  /**
   * Resolved values by default. `var` links retained references to emitted direct targets using
   * their actual variable names; other targets are inlined. Concat is projected verbatim, so
   * CSS token-stream substitution need not match core string concatenation.
   */
  readonly references?: "resolved" | "var";
  readonly activation?: CssActivationOptions<Mode>;
  /** Wrap the output in `@layer <name>`. */
  readonly cascadeLayer?: string;
}

export type CssActivationTier = "default" | "media" | "attribute" | "selector";

export interface CssVarDeclaration<Key extends string = string> {
  readonly tokenKey: Key;
  readonly property: string;
  /** The complete, safety-checked value inserted into CSS in either format. */
  readonly value: string;
}

/**
 * One mode's complete declarations under one activation condition. The emitted rule is
 * `:where(<selectors joined by ", ">)`, inside `@media <media>` when `media` is present.
 */
export interface CssVarBlock<Key extends string = string, Mode extends string = string> {
  readonly tier: CssActivationTier;
  readonly mode: Mode;
  readonly selectors: readonly [string, ...string[]];
  readonly media?: string;
  readonly declarations: readonly CssVarDeclaration<Key>[];
}

type CssVariableMap<Key extends string, Complete extends boolean> = Complete extends true
  ? Readonly<Record<Key, string>>
  : Readonly<Partial<Record<Key, string>>>;

export interface CssVarsExport<
  Key extends string = string,
  Mode extends string = string,
  Complete extends boolean = true,
> {
  readonly css: string;
  readonly blocks: readonly CssVarBlock<Key, Mode>[];
  readonly variableByToken: CssVariableMap<Key, Complete>;
}
