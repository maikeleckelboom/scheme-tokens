import { tokenKey } from "../core/keys";
import type { ColorSchemeTokenLayer } from "./layer";

export const appSurfaceLayer: ColorSchemeTokenLayer = {
  name: "app-surface",
  tokens: [
    { kind: "alias", key: tokenKey("chrome.background"), target: tokenKey("scheme.surface") },
    { kind: "alias", key: tokenKey("chrome.foreground"), target: tokenKey("scheme.onSurface") },
    { kind: "alias", key: tokenKey("chrome.border"), target: tokenKey("scheme.outlineVariant") },
    {
      kind: "alias",
      key: tokenKey("semantic.action.background"),
      target: tokenKey("scheme.primary"),
    },
    {
      kind: "alias",
      key: tokenKey("semantic.action.foreground"),
      target: tokenKey("scheme.onPrimary"),
    },
    {
      kind: "alias",
      key: tokenKey("semantic.danger.background"),
      target: tokenKey("scheme.error"),
    },
    {
      kind: "alias",
      key: tokenKey("semantic.danger.foreground"),
      target: tokenKey("scheme.onError"),
    },
  ],
};
