import type { Material3Issue } from "./material3";
import { describeUnknown } from "./safe-description";

export interface PlainRecordEntry {
  readonly key: string;
  readonly value: unknown;
}

export type PlainRecordResult =
  | {
      readonly ok: true;
      readonly value: readonly PlainRecordEntry[];
    }
  | {
      readonly ok: false;
      readonly issue: Material3Issue;
    };

export function readPlainRecord(input: unknown): PlainRecordResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return invalidInput(input);
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    return invalidInput(input);
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return invalidInput(input);
  }

  const entries: PlainRecordEntry[] = [];
  for (const key of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable) {
      continue;
    }
    if (!("value" in descriptor)) {
      return invalidInput(input);
    }
    entries.push({ key, value: descriptor.value });
  }
  return { ok: true, value: entries };
}

function invalidInput(input: unknown): PlainRecordResult {
  return {
    ok: false,
    issue: {
      code: "material3-invalid-input",
      message: "material3 input must be a JSON-safe plain object.",
      receivedType: describeUnknown(input),
    },
  };
}
