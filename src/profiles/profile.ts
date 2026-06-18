import type { TokenKey } from "../core/keys";
import type { TokenProvenance } from "../core/provenance";

export interface ProfileToken {
  readonly key: TokenKey;
  readonly target: TokenKey;
  readonly provenance?: TokenProvenance;
}

export interface ColorSchemeProfile {
  readonly name: string;
  readonly tokens: readonly ProfileToken[];
}
