export function validateNextVersion(version: string): string {
  const match =
    /^([1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-dev\.\d{8}(?:\.(?:0|[1-9]\d*))?$/u.exec(version);
  if (match === null || Number(match[1]) < 7) {
    throw new Error(`Unexpected TypeScript next version: ${version}`);
  }
  return version;
}
