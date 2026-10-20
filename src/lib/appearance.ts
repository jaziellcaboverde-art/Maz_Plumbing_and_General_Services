export const APPEARANCE_STORAGE_KEY = "maz-appearance-v1";

export const APPEARANCE_THEMES = ["light", "dark"] as const;
export const APPEARANCE_ACCENTS = ["sky", "blue", "royal", "cobalt", "navy"] as const;
export const APPEARANCE_DENSITIES = ["comfortable", "compact"] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number];
export type AppearanceAccent = (typeof APPEARANCE_ACCENTS)[number];
export type AppearanceDensity = (typeof APPEARANCE_DENSITIES)[number];

export type AppearancePreferences = {
  theme: AppearanceTheme;
  accent: AppearanceAccent;
  density: AppearanceDensity;
  showAvatars: boolean;
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "light",
  accent: "royal",
  density: "comfortable",
  showAvatars: true,
};

export function appearanceInitScript(): string {
  const key = JSON.stringify(APPEARANCE_STORAGE_KEY);
  const themes = JSON.stringify(APPEARANCE_THEMES);
  const accents = JSON.stringify(APPEARANCE_ACCENTS);
  const densities = JSON.stringify(APPEARANCE_DENSITIES);
  return `(function(){try{var p=JSON.parse(localStorage.getItem(${key})||"{}");var r=document.documentElement;if(${themes}.indexOf(p.theme)>-1)r.setAttribute("data-theme",p.theme);if(${accents}.indexOf(p.accent)>-1)r.setAttribute("data-accent",p.accent);if(${densities}.indexOf(p.density)>-1)r.setAttribute("data-density",p.density);if(typeof p.showAvatars==="boolean")r.setAttribute("data-show-avatars",String(p.showAvatars))}catch(e){}})()`;
}
