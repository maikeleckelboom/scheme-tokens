import { describe, expect, it } from "vitest";
import { validateNextVersion } from "../../scripts/type-compatibility-version.ts";

describe("TypeScript next version validation", () => {
  it.each(["7.1.0-dev.20260930.1", "8.0.0-dev.20261001.1", "10.2.0-dev.20270101"])(
    "accepts the non-blocking development signal %s",
    (version) => {
      expect(validateNextVersion(version)).toBe(version);
    },
  );

  it.each([
    "6.9.0-dev.20260930.1",
    "8.0.0",
    "8.0.0-next.1",
    "8.0-dev.20261001",
    "8.0.0-dev.bad",
    "08.0.0-dev.20261001",
  ])("rejects unexpected registry output %s", (version) => {
    expect(() => validateNextVersion(version)).toThrow(
      `Unexpected TypeScript next version: ${version}`,
    );
  });
});
