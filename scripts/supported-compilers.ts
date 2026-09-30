export interface SupportedCompiler {
  readonly version: string;
  readonly roles: readonly string[];
}

/** Consumer floors are independent of the exact repository development compiler. */
export function supportedCompilers(
  repositoryVersion: string,
  line?: string,
): readonly SupportedCompiler[] {
  if (!/^7\.\d+\.\d+$/u.test(repositoryVersion)) {
    throw new Error("The repository compiler must remain an exact stable TypeScript 7.x release");
  }
  if (line !== undefined && line !== "5.9" && line !== "6.0" && line !== "7.x") {
    throw new Error("Use compiler line 5.9, 6.0, or 7.x");
  }
  const versions = new Map<string, string[]>();
  for (const [majorLine, role, version] of [
    ["5.9", "5.9 consumer floor", "5.9.3"],
    ["6.0", "6.0 consumer floor", "6.0.2"],
    ["7.x", "7.0 consumer floor", "7.0.2"],
    ["7.x", "repository stable 7.x", repositoryVersion],
  ] as const) {
    if (line === undefined || line === majorLine) {
      versions.set(version, [...(versions.get(version) ?? []), role]);
    }
  }
  return [...versions].map(([version, roles]) => ({ version, roles }));
}
