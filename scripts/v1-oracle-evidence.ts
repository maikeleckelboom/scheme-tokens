import { createHash } from "node:crypto";

interface CompiledV1 {
  readonly modes: readonly string[];
  readonly defaultMode: string;
  readonly tokens: Readonly<Partial<Record<string, Readonly<Record<string, string>>>>>;
  readonly metadataByToken: Readonly<
    Partial<
      Record<
        string,
        {
          readonly visibility: string;
          readonly description?: string;
          readonly deprecated?: boolean | string;
          readonly extensions?: Readonly<Record<string, unknown>>;
        }
      >
    >
  >;
}

/** These fields have the same meaning in v1 and v2; v1 origin/dependencies do not. */
export function comparableV1Output(compiled: CompiledV1): unknown {
  return {
    modes: compiled.modes,
    defaultMode: compiled.defaultMode,
    tokens: compiled.tokens,
    metadataByToken: Object.fromEntries(
      Object.entries(compiled.metadataByToken).map(([key, metadata]) => {
        if (metadata === undefined) {
          throw new Error(`Missing metadata for ${key}`);
        }
        return [
          key,
          {
            visibility: metadata.visibility,
            ...(metadata.description === undefined ? {} : { description: metadata.description }),
            ...(metadata.deprecated === undefined ? {} : { deprecated: metadata.deprecated }),
            ...(metadata.extensions === undefined ? {} : { extensions: metadata.extensions }),
          },
        ];
      }),
    ),
  };
}

export function evidenceDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
