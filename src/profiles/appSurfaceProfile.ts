import { tokenKey } from "../core/keys";
import type { ColorSchemeProfile } from "./profile";

export const appSurfaceProfile: ColorSchemeProfile = {
  name: "app-surface",
  tokens: [
    { key: tokenKey("app.background"), target: tokenKey("scheme.background") },
    { key: tokenKey("app.surface"), target: tokenKey("scheme.surface") },
    { key: tokenKey("app.onSurface"), target: tokenKey("scheme.onSurface") },
    { key: tokenKey("app.surfaceMuted"), target: tokenKey("scheme.surfaceVariant") },
    { key: tokenKey("app.onSurfaceMuted"), target: tokenKey("scheme.onSurfaceVariant") },
    { key: tokenKey("app.action"), target: tokenKey("scheme.primary") },
    { key: tokenKey("app.onAction"), target: tokenKey("scheme.onPrimary") },
  ],
};
