import type { Issue } from "./result";
import { IssueCollector, type Result } from "./result";

export type JsonPrimitive = null | boolean | number | string;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | {
      readonly [key: string]: JsonValue;
    };

export interface RecordEntry {
  readonly key: string;
  readonly value: unknown;
}

export interface ArrayEntry {
  readonly index: number;
  readonly value: unknown;
}

export function pointer(...segments: readonly (string | number)[]): string {
  if (segments.length === 0) {
    return "";
  }
  return `/${segments.map((segment) => escapePointerSegment(String(segment))).join("/")}`;
}

export function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function readPlainRecord<Code extends string>(
  input: unknown,
  issue: Omit<Issue<Code>, "message"> & { readonly message?: string },
): Result<readonly RecordEntry[], Issue<Code>> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return invalidRecord(issue);
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    return invalidRecord(issue);
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return invalidRecord(issue);
  }

  const entries: RecordEntry[] = [];

  for (const key of Object.keys(descriptors).sort(compareCodeUnits)) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable) {
      continue;
    }
    if (!("value" in descriptor)) {
      return invalidRecord(issue);
    }
    entries.push({ key, value: descriptor.value });
  }

  return { ok: true, value: entries };
}

export function readArray<Code extends string>(
  input: unknown,
  issue: Omit<Issue<Code>, "message"> & { readonly message?: string },
): Result<readonly ArrayEntry[], Issue<Code>> {
  if (!Array.isArray(input)) {
    return invalidArray(issue);
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
  } catch {
    return invalidArray(issue);
  }

  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return invalidArray(issue);
  }

  const length = lengthDescriptor.value;
  const entries: ArrayEntry[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return invalidArray(issue);
    }
    entries.push({ index, value: descriptor.value });
  }

  for (const key of Object.keys(descriptors)) {
    if (key === "length") {
      continue;
    }
    const index = Number(key);
    const descriptor = descriptors[key];
    if (
      descriptor?.enumerable === true &&
      (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key)
    ) {
      return invalidArray(issue);
    }
  }

  return { ok: true, value: entries };
}

export function copyJsonValue<Code extends string>(
  input: unknown,
  options: {
    readonly path?: string;
    readonly code: Code;
    readonly message?: string;
  },
): Result<JsonValue, Issue<Code>> {
  const collector = new IssueCollector<Issue<Code>>();
  const copied = copyJsonValueInternal(
    input,
    options.path,
    options.code,
    options.message,
    new Set(),
    collector,
  );
  const issues = collector.issues();
  return issues === undefined ? { ok: true, value: copied as JsonValue } : { ok: false, issues };
}

export function isJsonSafeIssue(input: unknown): input is Issue {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }
  const entries = readPlainRecord(input, {
    code: "invalid-issue",
    message: "Issue must be a plain object.",
  });
  if (!entries.ok) {
    return false;
  }

  const record = Object.fromEntries(entries.value.map((entry) => [entry.key, entry.value]));
  if (typeof record.code !== "string" || record.code.length === 0) {
    return false;
  }
  if (typeof record.message !== "string") {
    return false;
  }
  if ("path" in record && typeof record.path !== "string") {
    return false;
  }

  return copyJsonValue(input, {
    code: "invalid-issue",
    message: "Issue must be JSON-safe.",
  }).ok;
}

export function defineRecordValue<Value>(
  record: Record<string, Value>,
  key: string,
  value: Value,
): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export function sortedRecord<Value>(
  entries: Iterable<readonly [string, Value]>,
): Readonly<Record<string, Value>> {
  const record: Record<string, Value> = {};
  for (const [key, value] of [...entries].sort(([left], [right]) =>
    compareCodeUnits(left, right),
  )) {
    defineRecordValue(record, key, value);
  }
  return record;
}

function invalidRecord<Code extends string>(
  issue: Omit<Issue<Code>, "message"> & { readonly message?: string },
): Result<never, Issue<Code>> {
  return {
    ok: false,
    issues: [
      {
        ...issue,
        message: issue.message ?? "Expected a plain object with enumerable data properties.",
      },
    ],
  };
}

function invalidArray<Code extends string>(
  issue: Omit<Issue<Code>, "message"> & { readonly message?: string },
): Result<never, Issue<Code>> {
  return {
    ok: false,
    issues: [
      {
        ...issue,
        message: issue.message ?? "Expected an array with dense enumerable data elements.",
      },
    ],
  };
}

function copyJsonValueInternal<Code extends string>(
  input: unknown,
  path: string | undefined,
  code: Code,
  message: string | undefined,
  seen: Set<object>,
  collector: IssueCollector<Issue<Code>>,
): JsonValue | undefined {
  if (input === null || typeof input === "string" || typeof input === "boolean") {
    return input;
  }

  if (typeof input === "number") {
    if (Number.isFinite(input)) {
      return normalizeNumber(input);
    }
    collector.add({
      code,
      message: message ?? "Expected a finite JSON number.",
      ...(path === undefined ? {} : { path }),
    });
    return undefined;
  }

  if (Array.isArray(input)) {
    if (seen.has(input)) {
      collector.add({
        code,
        message: message ?? "Cyclic JSON values are not supported.",
        ...(path === undefined ? {} : { path }),
      });
      return undefined;
    }

    const entries = readArray(input, {
      code,
      message: message ?? "Expected a JSON-safe array.",
      ...(path === undefined ? {} : { path }),
    });
    if (!entries.ok) {
      collector.addMany(entries.issues);
      return undefined;
    }

    seen.add(input);
    const output: JsonValue[] = [];
    for (const entry of entries.value) {
      output.push(
        copyJsonValueInternal(
          entry.value,
          childPointer(path, entry.index),
          code,
          message,
          seen,
          collector,
        ) ?? null,
      );
    }
    seen.delete(input);
    return output;
  }

  if (typeof input === "object") {
    if (seen.has(input)) {
      collector.add({
        code,
        message: message ?? "Cyclic JSON values are not supported.",
        ...(path === undefined ? {} : { path }),
      });
      return undefined;
    }

    const entries = readPlainRecord(input, {
      code,
      message: message ?? "Expected a JSON-safe plain object.",
      ...(path === undefined ? {} : { path }),
    });
    if (!entries.ok) {
      collector.addMany(entries.issues);
      return undefined;
    }

    seen.add(input);
    const output: Record<string, JsonValue> = {};
    for (const entry of entries.value) {
      const copied = copyJsonValueInternal(
        entry.value,
        childPointer(path, entry.key),
        code,
        message,
        seen,
        collector,
      );
      defineRecordValue(output, entry.key, copied ?? null);
    }
    seen.delete(input);
    return output;
  }

  collector.add({
    code,
    message: message ?? "Expected a JSON-safe value.",
    ...(path === undefined ? {} : { path }),
  });
  return undefined;
}

function childPointer(parent: string | undefined, segment: string | number): string {
  if (parent === undefined || parent === "") {
    return pointer(segment);
  }
  return `${parent}/${escapePointerSegment(String(segment))}`;
}
