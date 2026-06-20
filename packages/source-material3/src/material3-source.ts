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

export interface Material3SourceInput {
  readonly sourceColor: string;
  readonly id?: string;
  readonly defaultVisibility?: TokenVisibility;
}

export type Material3SourceIssue =
  | (Issue<"material3-invalid-input"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-invalid-source-color"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-unsupported-color-input"> & {
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
  | (Issue<"material3-engine-failed"> & {
      readonly enginePackage: typeof MATERIAL3_ENGINE_PACKAGE;
      readonly engineVersion: typeof MATERIAL3_ENGINE_VERSION;
    });

interface ParsedMaterial3SourceInput {
  readonly sourceId: string;
  readonly sourceColor: string | undefined;
  readonly defaultVisibility: TokenVisibility;
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

  for (const entry of entries.value) {
    if (entry.key !== "sourceColor" && entry.key !== "id" && entry.key !== "defaultVisibility") {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3Source input property: ${entry.key}.`,
        path: `/${entry.key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  return {
    sourceId,
    sourceColor,
    defaultVisibility,
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
      path: "/sourceColor",
    });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({
      code: "material3-unsupported-color-input",
      message: "sourceColor currently supports strict #rrggbb hex strings only.",
      path: "/sourceColor",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!strictHexPattern.test(value)) {
    issues.push({
      code: "material3-unsupported-color-input",
      message: "sourceColor currently supports strict #rrggbb hex strings only.",
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

function fail(issues: readonly Material3SourceIssue[]): Result<never, Material3SourceIssue> {
  if (issues.length === 0) {
    throw new Error("Expected at least one Material 3 source issue.");
  }
  return { ok: false, issues: issues as [Material3SourceIssue, ...Material3SourceIssue[]] };
}
