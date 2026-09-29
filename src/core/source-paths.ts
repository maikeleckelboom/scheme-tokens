/** Private prefix mapping; persisted artifacts never contain source-location fields. */
export class SourcePaths {
  readonly #paths = new Map<string, string>();

  set(path: string, original: string): void {
    this.#paths.set(path, original);
  }

  original(path: string): string {
    let prefix = path;
    while (prefix.length > 0) {
      const original = this.#paths.get(prefix);
      if (original !== undefined) {
        return original + path.slice(prefix.length);
      }
      prefix = prefix.slice(0, prefix.lastIndexOf("/"));
    }
    return path;
  }
}
