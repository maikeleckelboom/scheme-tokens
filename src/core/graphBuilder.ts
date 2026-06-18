import type { ColorSchemeTokenGraph, TokenNode } from "./graph";
import { darkMode, lightMode, type ModeKey } from "./modes";

export const GRAPH_SCHEMA_VERSION = "color-scheme-token-graph/v0";

export interface CreateSchemeGraphOptions {
  readonly modes?: readonly ModeKey[];
  readonly tokens?: readonly TokenNode[];
}

export function createSchemeGraph(options: CreateSchemeGraphOptions = {}): ColorSchemeTokenGraph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    modes: [...(options.modes ?? [lightMode, darkMode])],
    tokens: [...(options.tokens ?? [])],
  };
}
