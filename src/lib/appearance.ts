export const APPEARANCE_STORAGE_KEY = "amicitia_appearance_settings";

export const COLOR_THEMES = [
  {
    value: "emerald",
    label: "Emerald",
    preview: "hsl(157 67% 29%)",
  },
  {
    value: "ocean",
    label: "Ocean",
    preview: "hsl(205 88% 46%)",
  },
  {
    value: "rose",
    label: "Rose",
    preview: "hsl(346 77% 49%)",
  },
  {
    value: "amber",
    label: "Amber",
    preview: "hsl(32 95% 44%)",
  },
  {
    value: "violet",
    label: "Violet",
    preview: "hsl(262 83% 58%)",
  },
] as const;

export const FONT_SCALES = [
  { value: "compact", label: "Small", description: "More content on screen" },
  { value: "comfortable", label: "Default", description: "Balanced reading size" },
  { value: "large", label: "Large", description: "Easier to read" },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["value"];
export type FontScale = (typeof FONT_SCALES)[number]["value"];

export type AppearanceSettings = {
  colorTheme: ColorTheme;
  fontScale: FontScale;
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  colorTheme: "emerald",
  fontScale: "comfortable",
};

const isColorTheme = (value: string): value is ColorTheme =>
  COLOR_THEMES.some((theme) => theme.value === value);

const isFontScale = (value: string): value is FontScale =>
  FONT_SCALES.some((scale) => scale.value === value);

export const getStoredAppearance = (): AppearanceSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_APPEARANCE;
  }

  const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_APPEARANCE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      colorTheme: parsed.colorTheme && isColorTheme(parsed.colorTheme) ? parsed.colorTheme : DEFAULT_APPEARANCE.colorTheme,
      fontScale: parsed.fontScale && isFontScale(parsed.fontScale) ? parsed.fontScale : DEFAULT_APPEARANCE.fontScale,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
};

export const applyAppearanceSettings = (settings: AppearanceSettings) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.colorTheme = settings.colorTheme;
  root.dataset.fontScale = settings.fontScale;
};

export const persistAppearanceSettings = (settings: AppearanceSettings) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
};

export const updateAppearanceSettings = (settings: AppearanceSettings) => {
  applyAppearanceSettings(settings);
  persistAppearanceSettings(settings);
};

export const initializeAppearanceSettings = () => {
  applyAppearanceSettings(getStoredAppearance());
};
