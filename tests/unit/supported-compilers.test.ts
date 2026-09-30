import { describe, expect, it } from "vitest";
import { supportedCompilers } from "../../scripts/supported-compilers.ts";

describe("supported consumer compiler roles", () => {
  it("keeps exact consumer floors and deduplicates the stable repository role", () => {
    expect(supportedCompilers("7.0.2")).toEqual([
      { version: "5.9.3", roles: ["5.9 consumer floor"] },
      { version: "6.0.2", roles: ["6.0 consumer floor"] },
      { version: "7.0.2", roles: ["7.0 consumer floor", "repository stable 7.x"] },
    ]);
  });
  it("retains both 7.x versions when the development compiler advances", () => {
    expect(supportedCompilers("7.1.2", "7.x").map((compiler) => compiler.version)).toEqual([
      "7.0.2",
      "7.1.2",
    ]);
    expect(supportedCompilers("7.1.2", "5.9").map((compiler) => compiler.version)).toEqual([
      "5.9.3",
    ]);
  });
  it("rejects an unpinned development compiler or an unsupported role", () => {
    expect(() => supportedCompilers("^7.0.2")).toThrow("exact stable");
    expect(() => supportedCompilers("7.0.2", "5.8")).toThrow("compiler line");
  });
});
