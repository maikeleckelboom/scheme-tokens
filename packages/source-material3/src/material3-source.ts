import type {
  Issue,
  Result,
  TokenGraphInput,
  TokenSource,
  TokenVisibility,
} from "color-scheme-tokens";
import {
  createMaterial3Graph,
  MATERIAL3_ENGINE_PACKAGE,
  MATERIAL3_ENGINE_VERSION,
} from "./material3-engine";
import { readPlainRecord } from "./plain-record";
import { describeUnknown } from "./safe-description";

export interface Material3ExtendedColorInput {
  readonly name: string;
  readonly color: string;
  readonly harmonize?: boolean;
}

export interface Material3SourceInput {
  readonly sourceColor: string;
  readonly id?: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly extendedColors?: readonly Material3ExtendedColorInput[];
}

export type Material3SourceIssue =
  | (Issue<"material3-invalid-input"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-invalid-source-color"> & {
      readonly field: "sourceColor";
      readonly receivedType?: string;
    })
  | (Issue<"material3-unsupported-color-input"> & {
      readonly field: "sourceColor";
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-id"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-default-visibility"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-extended-colors"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-extended-color"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-extended-color-name"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-duplicate-extended-color-name"> & {
      readonly value: string;
    })
  | (Issue<"material3-unsupported-extended-color-input"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-extended-color-harmonize"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-engine-failed"> & {
      readonly enginePackage: typeof MATERIAL3_ENGINE_PACKAGE;
      readonly engineVersion: typeof MATERIAL3_ENGINE_VERSION;
    });

export interface Material3ExtendedColor {
  readonly name: string;
  readonly color: string;
  readonly harmonize: boolean;
}

interface ParsedMaterial3SourceInput {
  readonly sourceId: string;
  readonly sourceColor: string | undefined;
  readonly defaultVisibility: TokenVisibility;
  readonly extendedColors: readonly Material3ExtendedColor[];
  readonly issues: readonly Material3SourceIssue[];
}

const defaultSourceId = "material3";
const strictHexPattern = /^#[0-9a-fA-F]{6}$/;
const sourceIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function material3Source(input: Material3SourceInput): TokenSource<Material3SourceIssue> {
  const parsed = parseMaterial3SourceInput(input);

  return {
    id: parsed.sourceId,
    build(): Result<TokenGraphInput, Material3SourceIssue> {
      if (parsed.issues.length > 0) {
        return fail(parsed.issues);
      }
      if (parsed.sourceColor === undefined) {
        return fail([
          {
            code: "material3-invalid-source-color",
            message: "sourceColor is required.",
            field: "sourceColor",
            path: "/sourceColor",
          },
        ]);
      }

      try {
        return {
          ok: true,
          value: createMaterial3Graph({
            sourceColor: parsed.sourceColor,
            sourceId: parsed.sourceId,
            defaultVisibility: parsed.defaultVisibility,
            extendedColors: parsed.extendedColors,
          }),
        };
      } catch {
        return fail([
          {
            code: "material3-engine-failed",
            message: "The Material 3 engine failed while generating a token graph.",
            enginePackage: MATERIAL3_ENGINE_PACKAGE,
            engineVersion: MATERIAL3_ENGINE_VERSION,
          },
        ]);
      }
    },
  };
}

function parseMaterial3SourceInput(input: unknown): ParsedMaterial3SourceInput {
  const entries = readPlainRecord(input);
  if (!entries.ok) {
    return {
      sourceId: defaultSourceId,
      sourceColor: undefined,
      defaultVisibility: "public",
      extendedColors: [],
      issues: [entries.issue],
    };
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const issues: Material3SourceIssue[] = [];
  const sourceId = parseSourceId(record.get("id"), record.has("id"), issues);
  const sourceColor = parseSourceColor(
    record.get("sourceColor"),
    record.has("sourceColor"),
    issues,
  );
  const defaultVisibility = parseDefaultVisibility(
    record.get("defaultVisibility"),
    record.has("defaultVisibility"),
    issues,
  );
  const extendedColors = parseExtendedColors(
    record.get("extendedColors"),
    record.has("extendedColors"),
    issues,
  );

  for (const entry of entries.value) {
    if (
      entry.key !== "sourceColor" &&
      entry.key !== "id" &&
      entry.key !== "defaultVisibility" &&
      entry.key !== "extendedColors"
    ) {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3Source input property: ${entry.key}.`,
        path: `/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  return {
    sourceId,
    sourceColor,
    defaultVisibility,
    extendedColors,
    issues,
  };
}

function parseSourceId(value: unknown, hasValue: boolean, issues: Material3SourceIssue[]): string {
  if (!hasValue) {
    return defaultSourceId;
  }
  if (typeof value === "string" && sourceIdPattern.test(value)) {
    return value;
  }
  issues.push({
    code: "material3-invalid-id",
    message: "id must be a lower-kebab single segment.",
    path: "/id",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultSourceId;
}

function parseSourceColor(
  value: unknown,
  hasValue: boolean,
  issues: Material3SourceIssue[],
): string | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-invalid-source-color",
      message: "sourceColor is required.",
      field: "sourceColor",
      path: "/sourceColor",
    });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({
      code: "material3-unsupported-color-input",
      message: "sourceColor currently supports strict #rrggbb hex strings only.",
      field: "sourceColor",
      path: "/sourceColor",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!strictHexPattern.test(value)) {
    issues.push({
      code: "material3-unsupported-color-input",
      message: "sourceColor currently supports strict #rrggbb hex strings only.",
      field: "sourceColor",
      path: "/sourceColor",
      value,
    });
    return undefined;
  }
  return value.toLowerCase();
}

function parseDefaultVisibility(
  value: unknown,
  hasValue: boolean,
  issues: Material3SourceIssue[],
): TokenVisibility {
  if (!hasValue) {
    return "public";
  }
  if (value === "public" || value === "internal") {
    return value;
  }
  issues.push({
    code: "material3-invalid-default-visibility",
    message: "defaultVisibility must be public or internal.",
    path: "/defaultVisibility",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return "public";
}

function parseExtendedColors(
  value: unknown,
  hasValue: boolean,
  issues: Material3SourceIssue[],
): readonly Material3ExtendedColor[] {
  if (!hasValue) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({
      code: "material3-invalid-extended-colors",
      message: "extendedColors must be an array.",
      path: "/extendedColors",
      receivedType: describeUnknown(value),
    });
    return [];
  }

  let items: readonly unknown[];
  try {
    items = [...value];
  } catch {
    issues.push({
      code: "material3-invalid-extended-colors",
      message: "extendedColors must be an array.",
      path: "/extendedColors",
      receivedType: describeUnknown(value),
    });
    return [];
  }

  const colors: Material3ExtendedColor[] = [];
  const seenNames = new Set<string>();
  for (const [index, item] of items.entries()) {
    const color = parseExtendedColor(item, index, issues);
    if (color === undefined) {
      continue;
    }
    if (seenNames.has(color.name)) {
      issues.push({
        code: "material3-duplicate-extended-color-name",
        message: `Duplicate extended color name: ${color.name}.`,
        path: `/extendedColors/${index}/name`,
        value: color.name,
      });
      continue;
    }
    seenNames.add(color.name);
    colors.push(color);
  }
  return colors;
}

function parseExtendedColor(
  input: unknown,
  index: number,
  issues: Material3SourceIssue[],
): Material3ExtendedColor | undefined {
  const path = `/extendedColors/${index}`;
  const entries = readPlainRecord(input);
  if (!entries.ok) {
    issues.push({
      code: "material3-invalid-extended-color",
      message: "extendedColors entries must be JSON-safe plain objects.",
      path,
      receivedType:
        "receivedType" in entries.issue ? entries.issue.receivedType : describeUnknown(input),
    });
    return undefined;
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const name = parseExtendedColorName(record.get("name"), record.has("name"), path, issues);
  const color = parseExtendedColorValue(record.get("color"), record.has("color"), path, issues);
  const harmonize = parseExtendedColorHarmonize(
    record.get("harmonize"),
    record.has("harmonize"),
    path,
    issues,
  );

  for (const entry of entries.value) {
    if (entry.key !== "name" && entry.key !== "color" && entry.key !== "harmonize") {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3Source extendedColors entry property: ${entry.key}.`,
        path: `${path}/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  if (name === undefined || color === undefined || harmonize === undefined) {
    return undefined;
  }
  return { name, color, harmonize };
}

function parseExtendedColorName(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3SourceIssue[],
): string | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name is required.",
      path: `${path}/name`,
    });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name must be a lower-kebab single segment.",
      path: `${path}/name`,
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!sourceIdPattern.test(value)) {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name must be a lower-kebab single segment.",
      path: `${path}/name`,
      value,
    });
    return undefined;
  }
  return value;
}

function parseExtendedColorValue(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3SourceIssue[],
): string | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-unsupported-extended-color-input",
      message: "extended color color is required.",
      path: `${path}/color`,
    });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({
      code: "material3-unsupported-extended-color-input",
      message: "extended color color currently supports strict #rrggbb hex strings only.",
      path: `${path}/color`,
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!strictHexPattern.test(value)) {
    issues.push({
      code: "material3-unsupported-extended-color-input",
      message: "extended color color currently supports strict #rrggbb hex strings only.",
      path: `${path}/color`,
      value,
    });
    return undefined;
  }
  return value.toLowerCase();
}

function parseExtendedColorHarmonize(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3SourceIssue[],
): boolean | undefined {
  if (!hasValue) {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  issues.push({
    code: "material3-invalid-extended-color-harmonize",
    message: "extended color harmonize must be a boolean.",
    path: `${path}/harmonize`,
    receivedType: describeUnknown(value),
  });
  return undefined;
}

function jsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function fail(issues: readonly Material3SourceIssue[]): Result<never, Material3SourceIssue> {
  if (issues.length === 0) {
    throw new Error("Expected at least one Material 3 source issue.");
  }
  return { ok: false, issues: issues as [Material3SourceIssue, ...Material3SourceIssue[]] };
}
