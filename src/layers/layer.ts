import type { TokenNode } from "../core/graph";

export interface ColorSchemeTokenLayer {
  readonly name?: string;
  readonly tokens: readonly TokenNode[];
}
