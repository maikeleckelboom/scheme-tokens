import type { ColorValue } from "./colorValue";
import type { CompiledTokenSet } from "./compileGraph";
import type { ModeKey } from "./modes";

export interface SerializeTokenSetOptions {
  readonly space?: number;
}

export function serializeTokenSet(
  tokenSet: CompiledTokenSet,
  options: SerializeTokenSetOptions = {},
): string {
  const modeOrder = new Map(tokenSet.modes.map((mode, index) => [String(mode), index]));
  const canonical = {
    schemaVersion: tokenSet.schemaVersion,
    modes: tokenSet.modes.map(String),
    tokens: [...tokenSet.tokens]
      .sort((left, right) => String(left.key).localeCompare(String(right.key)))
      .map((token) => ({
        key: String(token.key),
        values: [...token.values]
          .sort((left, right) => compareModes(left.mode, right.mode, modeOrder))
          .map((entry) => ({
            mode: String(entry.mode),
            value: serializeColorValue(entry.value),
          })),
        ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
      })),
  };

  return `${JSON.stringify(canonical, null, options.space ?? 2)}\n`;
}

function serializeColorValue(value: ColorValue): ColorValue {
  return { ...value };
}

function compareModes(
  left: ModeKey,
  right: ModeKey,
  modeOrder: ReadonlyMap<string, number>,
): number {
  return (modeOrder.get(String(left)) ?? 0) - (modeOrder.get(String(right)) ?? 0);
}
