import type { TokenSource } from "scheme-tokens";
import {
  material3,
  material3Preset,
  material3Platforms,
  material3SpecVersions,
  material3Variants,
  type Material3ExtendedColorInput,
  type Material3GenerationOptions,
  type Material3Input,
  type Material3IntegrationOptions,
  type Material3Issue,
  type Material3PaletteOverridesInput,
  type Material3Platform,
  type Material3Preset,
  type Material3SourceColorsInput,
  type Material3SpecVersion,
  type Material3Variant,
} from "../../src";

const variant: Material3Variant = material3Variants[0];
const specVersion: Material3SpecVersion = material3SpecVersions[0];
const platform: Material3Platform = material3Platforms[0];
const scalarSourceColors: Material3SourceColorsInput = "#6750a4";
const arraySourceColors: Material3SourceColorsInput = ["#6750a4", "#00a88f"];
const mutableArraySourceColors: string[] = ["#6750a4", "#00a88f"];
const palettes: Material3PaletteOverridesInput = {
  primary: "#6750a4",
  neutralVariant: "#605d66",
};
const extendedColor: Material3ExtendedColorInput = {
  name: "success",
  color: "#2e7d32",
  harmonize: true,
  description: "Positive state color",
};

const input: Material3Input = {
  sourceColors: scalarSourceColors,
  variant,
  contrastLevel: 0.5,
  specVersion,
  platform,
  palettes,
  extendedColors: [extendedColor],
  paletteTones: [40, 90],
};
const options: Material3IntegrationOptions = {
  id: "brand-material",
  defaultVisibility: "internal",
};
const generationOptions: Material3GenerationOptions = {
  variant: "expressive",
  specVersion: "2026",
};

const source: TokenSource<Material3Issue> = material3(input, options);
source.id.toUpperCase();
material3({ sourceColors: arraySourceColors });
material3({ sourceColors: mutableArraySourceColors });
material3({ sourceColors: "#6750a4", paletteTones: true });
material3("#6750a4");
material3(["#6750a4"]);
material3(mutableArraySourceColors);
material3(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" });
material3("#6750a4", generationOptions);
material3("#6750a4", { variant: "expressive" }, { defaultVisibility: "internal" });
material3({ sourceColors: "#6750a4", variant: "expressive" }, { defaultVisibility: "internal" });

const preset: Material3Preset = material3Preset(generationOptions, options);
const presetSource: TokenSource<Material3Issue> = preset("#6750a4");
presetSource.id.toUpperCase();
preset(arraySourceColors);
preset(mutableArraySourceColors);
preset(["#6750a4", "#00a88f"], { variant: "cmf", specVersion: "2026" });
preset({ sourceColors: "#6750a4", variant: "expressive" });

// @ts-expect-error sourceColors belong to runtime calls, not preset defaults.
material3Preset({ sourceColors: "#6750a4" });

// @ts-expect-error id belongs in Material 3 integration options.
material3Preset({ id: "brand-material" });

// @ts-expect-error defaultVisibility belongs in Material 3 integration options.
material3Preset({ defaultVisibility: "internal" });

// @ts-expect-error preset runtime calls do not accept integration options.
preset("#6750a4", {}, { defaultVisibility: "internal" });

// @ts-expect-error id is not a runtime generation option for presets.
preset("#6750a4", { id: "brand-material" });

// @ts-expect-error sourceColors is required.
material3({});

material3({ sourceColors: [] });

// @ts-expect-error id belongs in the second argument.
material3({ sourceColors: "#6750a4", id: "brand-material" });

// @ts-expect-error defaultVisibility belongs in the second argument.
material3({ sourceColors: "#6750a4", defaultVisibility: "internal" });

// @ts-expect-error id belongs in the third argument for shorthand calls.
material3("#6750a4", { id: "brand-material" });

// @ts-expect-error defaultVisibility belongs in the third argument for shorthand calls.
material3("#6750a4", { defaultVisibility: "internal" });

// @ts-expect-error Material generation options do not belong in integration options.
material3("#6750a4", {}, { variant: "expressive" });

// @ts-expect-error sourceColor is not an alias for sourceColors.
material3({ sourceColor: "#6750a4" });

// @ts-expect-error color is not a Material 3 source option.
material3({ color: "#6750a4" });

// @ts-expect-error seedColor is not a Material 3 source option.
material3({ seedColor: "#6750a4" });

// @ts-expect-error primary is not a top-level source color fallback.
material3({ primary: "#6750a4" });

// @ts-expect-error style is not an alias for variant.
material3({ sourceColors: "#6750a4", style: "vibrant" });

// @ts-expect-error customColors is not an alias for extendedColors.
material3({ sourceColors: "#6750a4", customColors: [] });

const removedMaterialHelper = `material${"3"}Source`;
// @ts-expect-error removed Material helper name is not a public option.
material3({ sourceColors: "#6750a4", [removedMaterialHelper]: true });

// @ts-expect-error harmonize must be boolean when provided.
material3({
  sourceColors: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      harmonize: "yes",
    },
  ],
});

// @ts-expect-error value is not a public extended color option.
material3({
  sourceColors: "#6750a4",
  extendedColors: [
    {
      name: "success",
      value: "#2e7d32",
    },
  ],
});

// @ts-expect-error blend is not a public extended color option.
material3({
  sourceColors: "#6750a4",
  extendedColors: [
    {
      name: "success",
      color: "#2e7d32",
      blend: true,
    },
  ],
});
