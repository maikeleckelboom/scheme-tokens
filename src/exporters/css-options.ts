import type { CompiledScheme } from "../core/compiled-types";
import {
  isCascadeLayerName,
  isDataAttributeName,
  isSingleSegmentIdentifier,
} from "../core/identifiers";
import { readArray, readPlainRecord } from "../core/json";
import { IssueCollector, type Result } from "../core/result";
import { describeUnknown } from "../core/unknown-description";
import type { CssVariableNameInput, ExportCssVarsIssue } from "./css-types";
import { isValidMediaCondition } from "./media-validation";
import { isValidCssSelector } from "./selector-validation";

export interface ParsedCssCondition {
  readonly selector: string;
  readonly media?: string;
}

export interface ParsedCssOptions {
  readonly prefix?: string;
  readonly variableName?: (input: CssVariableNameInput) => unknown;
  readonly compact: boolean;
  readonly references: "resolved" | "var";
  readonly root: string;
  /** The explicit-tier attribute, or `undefined` when no explicit markers are generated. */
  readonly attribute?: string;
  /** System media condition by mode. */
  readonly system: ReadonlyMap<string, string>;
  /** Custom conditions by mode, in authored condition order. */
  readonly selectors: ReadonlyMap<string, readonly ParsedCssCondition[]>;
  readonly cascadeLayer?: string;
}

const DEFAULT_ROOT = ":root";
const DEFAULT_ATTRIBUTE = "data-theme";

type Collector = IssueCollector<ExportCssVarsIssue>;

/**
 * Validate and copy untrusted CSS options. Options are read as plain data in code-unit key
 * order, so every independent failure is reported, in an order that does not depend on how the
 * caller built the object. Explicit `undefined` means the option is omitted.
 */
export function parseCssOptions(
  scheme: CompiledScheme<string, string, boolean>,
  input: unknown,
): Result<ParsedCssOptions, ExportCssVarsIssue> {
  const entries =
    input === undefined
      ? ({ ok: true, value: [] } as const)
      : readPlainRecord(input, {
          code: "invalid-css-options",
          message: "CSS options must be a plain object.",
        });
  if (!entries.ok) {
    return entries;
  }

  const collector: Collector = new IssueCollector();
  const modes = new Set<string>(scheme.modes);
  let prefix: string | undefined;
  let variableName: ((input: CssVariableNameInput) => unknown) | undefined;
  let compact = false;
  let references: "resolved" | "var" = "resolved";
  let root = DEFAULT_ROOT;
  let attribute: string | false | undefined;
  let system: ReadonlyMap<string, string> = new Map();
  let selectors: ReadonlyMap<string, readonly ParsedCssCondition[]> = new Map();
  let cascadeLayer: string | undefined;

  for (const { key, value } of entries.value) {
    if (!isKnownOption(key)) {
      collector.add({
        code: "invalid-css-options",
        message: `Unknown CSS option: ${JSON.stringify(key)}.`,
        option: key,
      });
      continue;
    }
    if (value === undefined) {
      continue;
    }
    switch (key) {
      case "attribute":
        attribute = parseAttribute(value, collector);
        break;
      case "cascadeLayer":
        cascadeLayer = parseCascadeLayer(value, collector);
        break;
      case "format":
        compact = parseFormat(value, collector);
        break;
      case "prefix":
        prefix = parsePrefix(value, collector);
        break;
      case "references":
        references = parseReferences(value, collector);
        break;
      case "root":
        root = parseRoot(value, collector);
        break;
      case "selectors":
        selectors = parseCustomConditions(value, modes, collector);
        break;
      case "system":
        system = parseSystemConditions(value, modes, collector);
        break;
      case "variableName":
        variableName = parseVariableName(value, collector);
        break;
    }
  }

  return collector.result({
    ...(prefix === undefined ? {} : { prefix }),
    ...(variableName === undefined ? {} : { variableName }),
    compact,
    references,
    root,
    ...resolveAttribute(attribute, scheme.modes.length),
    system,
    selectors,
    ...(cascadeLayer === undefined ? {} : { cascadeLayer }),
  });
}

const OPTION_NAMES = new Set([
  "attribute",
  "cascadeLayer",
  "format",
  "prefix",
  "references",
  "root",
  "selectors",
  "system",
  "variableName",
] as const);
type OptionName = typeof OPTION_NAMES extends Set<infer Name> ? Name : never;

function isKnownOption(key: string): key is OptionName {
  return (OPTION_NAMES as ReadonlySet<string>).has(key);
}

// Omitting `attribute` selects the conventional marker, but only a multi-mode scheme needs one.
function resolveAttribute(
  attribute: string | false | undefined,
  modeCount: number,
): { readonly attribute?: string } {
  if (attribute === false) {
    return {};
  }
  if (attribute === undefined) {
    return modeCount > 1 ? { attribute: DEFAULT_ATTRIBUTE } : {};
  }
  return { attribute };
}

function parsePrefix(value: unknown, collector: Collector): string | undefined {
  if (typeof value === "string" && isSingleSegmentIdentifier(value)) {
    return value;
  }
  collector.add({
    code: "invalid-css-prefix",
    message: `prefix must be a lower-kebab single segment, received ${describeUnknown(value)}.`,
  });
  return undefined;
}

function parseVariableName(
  value: unknown,
  collector: Collector,
): ((input: CssVariableNameInput) => unknown) | undefined {
  if (typeof value === "function") {
    return (input) => value(input) as unknown;
  }
  collector.add({
    code: "invalid-css-options",
    message: "variableName must be a function.",
    option: "variableName",
  });
  return undefined;
}

function parseFormat(value: unknown, collector: Collector): boolean {
  if (value === "pretty" || value === "compact") {
    return value === "compact";
  }
  collector.add({
    code: "invalid-css-options",
    message: `format must be "pretty" or "compact", received ${describeUnknown(value)}.`,
    option: "format",
  });
  return false;
}

function parseReferences(value: unknown, collector: Collector): "resolved" | "var" {
  if (value === "resolved" || value === "var") {
    return value;
  }
  collector.add({
    code: "invalid-css-options",
    message: `references must be "resolved" or "var", received ${describeUnknown(value)}.`,
    option: "references",
  });
  return "resolved";
}

function parseRoot(value: unknown, collector: Collector): string {
  if (typeof value === "string" && isValidCssSelector(value)) {
    return value;
  }
  collector.add({
    code: "invalid-root",
    message: `root must be a selector in the bounded selector grammar, received ${describeUnknown(value)}.`,
    ...(typeof value === "string" ? { selector: value } : {}),
  });
  return DEFAULT_ROOT;
}

function parseAttribute(value: unknown, collector: Collector): string | false | undefined {
  if (value === false || (typeof value === "string" && isDataAttributeName(value))) {
    return value;
  }
  collector.add({
    code: "invalid-attribute",
    message: `attribute must be false or a lower-kebab data-* attribute name, received ${describeUnknown(value)}.`,
  });
  return undefined;
}

function parseCascadeLayer(value: unknown, collector: Collector): string | undefined {
  if (typeof value === "string" && isCascadeLayerName(value)) {
    return value;
  }
  collector.add({
    code: "invalid-cascade-layer",
    message: `cascadeLayer must be dot-separated lower-kebab layer names, received ${describeUnknown(value)}.`,
  });
  return undefined;
}

function parseSystemConditions(
  value: unknown,
  modes: ReadonlySet<string>,
  collector: Collector,
): ReadonlyMap<string, string> {
  const entries = readConditionRecord(value, "system", collector);
  const system = new Map<string, string>();
  for (const { key: mode, value: media } of entries) {
    if (media === undefined) {
      continue;
    }
    const known = reportUnknownMode(mode, "system", modes, collector);
    const parsed = parseMedia(media, { tier: "system", mode }, collector);
    if (known && parsed !== undefined) {
      system.set(mode, parsed);
    }
  }
  return system;
}

function parseCustomConditions(
  value: unknown,
  modes: ReadonlySet<string>,
  collector: Collector,
): ReadonlyMap<string, readonly ParsedCssCondition[]> {
  const entries = readConditionRecord(value, "selectors", collector);
  const selectors = new Map<string, readonly ParsedCssCondition[]>();
  for (const { key: mode, value: conditions } of entries) {
    if (conditions === undefined) {
      continue;
    }
    const known = reportUnknownMode(mode, "custom", modes, collector);
    const parsed = parseModeConditions(mode, conditions, collector);
    if (known && parsed !== undefined) {
      selectors.set(mode, parsed);
    }
  }
  return selectors;
}

function readConditionRecord(
  value: unknown,
  option: "selectors" | "system",
  collector: Collector,
): readonly { readonly key: string; readonly value: unknown }[] {
  const entries = readPlainRecord(value, {
    code: "invalid-css-options",
    message: `${option} must be a plain object keyed by mode.`,
  });
  if (!entries.ok) {
    collector.add({ ...entries.issues[0], option });
    return [];
  }
  return entries.value;
}

function reportUnknownMode(
  mode: string,
  tier: "system" | "custom",
  modes: ReadonlySet<string>,
  collector: Collector,
): boolean {
  if (modes.has(mode)) {
    return true;
  }
  collector.add({
    code: "unknown-condition-mode",
    message: `${tier === "system" ? "system" : "selectors"} names a mode the scheme does not have: ${JSON.stringify(mode)}.`,
    tier,
    mode,
  });
  return false;
}

function parseModeConditions(
  mode: string,
  value: unknown,
  collector: Collector,
): readonly ParsedCssCondition[] | undefined {
  if (typeof value === "string") {
    const selector = parseSelector(value, { mode }, collector);
    return selector === undefined ? undefined : [{ selector }];
  }

  const entries = readArray(value, {
    code: "invalid-custom-condition",
    message: "A custom condition must be a selector string or a non-empty list of conditions.",
  });
  if (!entries.ok) {
    collector.add({ ...entries.issues[0], tier: "custom", mode });
    return undefined;
  }
  if (entries.value.length === 0) {
    collector.add({
      code: "invalid-custom-condition",
      message: "A custom condition list must not be empty.",
      tier: "custom",
      mode,
    });
    return undefined;
  }

  const conditions: ParsedCssCondition[] = [];
  let valid = true;
  for (const { index, value: condition } of entries.value) {
    const parsed = parseCondition(condition, mode, index, collector);
    if (parsed === undefined) {
      valid = false;
    } else {
      conditions.push(parsed);
    }
  }
  return valid ? conditions : undefined;
}

function parseCondition(
  value: unknown,
  mode: string,
  index: number,
  collector: Collector,
): ParsedCssCondition | undefined {
  const context = { mode, index };
  const entries = readPlainRecord(value, {
    code: "invalid-custom-condition",
    message: "A custom condition must be a plain object with selector and optional media.",
  });
  if (!entries.ok) {
    collector.add({ ...entries.issues[0], tier: "custom", ...context });
    return undefined;
  }

  let selectorInput: unknown;
  let mediaInput: unknown;
  let valid = true;
  for (const entry of entries.value) {
    if (entry.key === "selector") {
      selectorInput = entry.value;
    } else if (entry.key === "media") {
      mediaInput = entry.value;
    } else {
      valid = false;
      collector.add({
        code: "invalid-custom-condition",
        message: `Unknown custom condition property: ${JSON.stringify(entry.key)}.`,
        tier: "custom",
        ...context,
      });
    }
  }

  let selector: string | undefined;
  if (selectorInput === undefined) {
    collector.add({
      code: "invalid-custom-condition",
      message: "A custom condition requires a selector.",
      tier: "custom",
      ...context,
    });
  } else {
    selector = parseSelector(selectorInput, context, collector);
  }
  const media =
    mediaInput === undefined
      ? undefined
      : parseMedia(mediaInput, { tier: "custom", ...context }, collector);
  if (!valid || selector === undefined || (mediaInput !== undefined && media === undefined)) {
    return undefined;
  }
  return media === undefined ? { selector } : { selector, media };
}

function parseSelector(
  value: unknown,
  context: { readonly mode: string; readonly index?: number },
  collector: Collector,
): string | undefined {
  if (typeof value === "string" && isValidCssSelector(value)) {
    return value;
  }
  collector.add({
    code: "invalid-selector",
    message: `Custom condition selectors must be in the bounded selector grammar, received ${describeUnknown(value)}.`,
    tier: "custom",
    ...context,
    ...(typeof value === "string" ? { selector: value } : {}),
  });
  return undefined;
}

function parseMedia(
  value: unknown,
  context: { readonly tier: "system" | "custom"; readonly mode: string; readonly index?: number },
  collector: Collector,
): string | undefined {
  if (typeof value === "string" && isValidMediaCondition(value)) {
    return value;
  }
  collector.add({
    code: "invalid-media",
    message: `Media conditions must be in the bounded media grammar, received ${describeUnknown(value)}.`,
    ...context,
    ...(typeof value === "string" ? { media: value } : {}),
  });
  return undefined;
}
