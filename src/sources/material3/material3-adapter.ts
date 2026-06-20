interface SchemeLike {
  readonly roles: Readonly<Record<string, number>>;
}

interface KeyColorArgbs {
  readonly primary?: number;
  readonly secondary?: number;
  readonly tertiary?: number;
  readonly neutral?: number;
  readonly neutralVariant?: number;
}

export function createMaterialScheme(options: {
  readonly sourceColorArgb: number;
  readonly keyColorArgbs?: KeyColorArgbs;
  readonly isDark: boolean;
  readonly contrastLevel: number;
  readonly specVersion: "2021" | "2025";
  readonly platform: "phone" | "watch";
  readonly variant: "tonalSpot" | "vibrant" | "expressive" | "neutral";
}): SchemeLike {
  const primary = rgbFromArgb(options.keyColorArgbs?.primary ?? options.sourceColorArgb);
  const secondary = rgbFromArgb(options.keyColorArgbs?.secondary ?? harmonize(primary, 0.78));
  const tertiary = rgbFromArgb(options.keyColorArgbs?.tertiary ?? argbFromRgb(rotate(primary)));
  const neutral = rgbFromArgb(options.keyColorArgbs?.neutral ?? argbFromRgb(neutralize(primary)));
  const neutralVariant = rgbFromArgb(
    options.keyColorArgbs?.neutralVariant ?? argbFromRgb(neutralize(secondary)),
  );
  const error = { r: 186, g: 26, b: 26 };
  const contrast = Math.max(-1, Math.min(1, options.contrastLevel));
  const dark = options.isDark;

  const roles: Record<string, number> = {
    primaryPaletteKeyColor: argbFromRgb(primary),
    secondaryPaletteKeyColor: argbFromRgb(secondary),
    tertiaryPaletteKeyColor: argbFromRgb(tertiary),
    neutralPaletteKeyColor: argbFromRgb(neutral),
    neutralVariantPaletteKeyColor: argbFromRgb(neutralVariant),
    errorPaletteKeyColor: argbFromRgb(error),
    background: tone(neutral, dark ? 6 : 99, contrast),
    onBackground: tone(neutral, dark ? 90 : 10, contrast),
    surface: tone(neutral, dark ? 6 : 99, contrast),
    surfaceDim: tone(neutral, dark ? 6 : 87, contrast),
    surfaceBright: tone(neutral, dark ? 24 : 98, contrast),
    surfaceContainerLowest: tone(neutral, dark ? 4 : 100, contrast),
    surfaceContainerLow: tone(neutral, dark ? 10 : 96, contrast),
    surfaceContainer: tone(neutral, dark ? 12 : 94, contrast),
    surfaceContainerHigh: tone(neutral, dark ? 17 : 92, contrast),
    surfaceContainerHighest: tone(neutral, dark ? 22 : 90, contrast),
    onSurface: tone(neutral, dark ? 90 : 10, contrast),
    surfaceVariant: tone(neutralVariant, dark ? 30 : 90, contrast),
    onSurfaceVariant: tone(neutralVariant, dark ? 80 : 30, contrast),
    inverseSurface: tone(neutral, dark ? 90 : 20, contrast),
    inverseOnSurface: tone(neutral, dark ? 20 : 95, contrast),
    outline: tone(neutralVariant, dark ? 60 : 50, contrast),
    outlineVariant: tone(neutralVariant, dark ? 30 : 80, contrast),
    shadow: argbFromRgb({ r: 0, g: 0, b: 0 }),
    scrim: argbFromRgb({ r: 0, g: 0, b: 0 }),
    surfaceTint: argbFromRgb(primary),
    primary: tone(primary, dark ? 80 : 40, contrast),
    onPrimary: tone(primary, dark ? 20 : 100, contrast),
    primaryContainer: tone(primary, dark ? 30 : 90, contrast),
    onPrimaryContainer: tone(primary, dark ? 90 : 10, contrast),
    inversePrimary: tone(primary, dark ? 40 : 80, contrast),
    secondary: tone(secondary, dark ? 80 : 40, contrast),
    onSecondary: tone(secondary, dark ? 20 : 100, contrast),
    secondaryContainer: tone(secondary, dark ? 30 : 90, contrast),
    onSecondaryContainer: tone(secondary, dark ? 90 : 10, contrast),
    tertiary: tone(tertiary, dark ? 80 : 40, contrast),
    onTertiary: tone(tertiary, dark ? 20 : 100, contrast),
    tertiaryContainer: tone(tertiary, dark ? 30 : 90, contrast),
    onTertiaryContainer: tone(tertiary, dark ? 90 : 10, contrast),
    error: tone(error, dark ? 80 : 40, contrast),
    onError: tone(error, dark ? 20 : 100, contrast),
    errorContainer: tone(error, dark ? 30 : 90, contrast),
    onErrorContainer: tone(error, dark ? 90 : 10, contrast),
    primaryFixed: tone(primary, 90, contrast),
    primaryFixedDim: tone(primary, 80, contrast),
    onPrimaryFixed: tone(primary, 10, contrast),
    onPrimaryFixedVariant: tone(primary, 30, contrast),
    secondaryFixed: tone(secondary, 90, contrast),
    secondaryFixedDim: tone(secondary, 80, contrast),
    onSecondaryFixed: tone(secondary, 10, contrast),
    onSecondaryFixedVariant: tone(secondary, 30, contrast),
    tertiaryFixed: tone(tertiary, 90, contrast),
    tertiaryFixedDim: tone(tertiary, 80, contrast),
    onTertiaryFixed: tone(tertiary, 10, contrast),
    onTertiaryFixedVariant: tone(tertiary, 30, contrast),
  };

  return { roles };
}

export function readSchemeRoleArgb(scheme: SchemeLike, role: string): number | undefined {
  return scheme.roles[role];
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

function rgbFromArgb(argb: number): Rgb {
  return {
    r: (argb >>> 16) & 0xff,
    g: (argb >>> 8) & 0xff,
    b: argb & 0xff,
  };
}

function argbFromRgb(rgb: Rgb): number {
  return ((0xff << 24) | (byte(rgb.r) << 16) | (byte(rgb.g) << 8) | byte(rgb.b)) >>> 0;
}

function tone(base: Rgb, toneValue: number, contrast: number): number {
  const adjustedTone = Math.max(0, Math.min(100, toneValue + contrast * (toneValue < 50 ? -8 : 8)));
  const target = adjustedTone >= 50 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const amount = adjustedTone >= 50 ? (adjustedTone - 50) / 50 : (50 - adjustedTone) / 50;
  return argbFromRgb(mix(base, target, amount));
}

function harmonize(base: Rgb, amount: number): number {
  return argbFromRgb(mix(base, neutralize(base), amount));
}

function neutralize(base: Rgb): Rgb {
  const average = (base.r + base.g + base.b) / 3;
  return mix(base, { r: average, g: average, b: average }, 0.82);
}

function rotate(base: Rgb): Rgb {
  return { r: base.b, g: base.r, b: base.g };
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  return {
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount,
  };
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
