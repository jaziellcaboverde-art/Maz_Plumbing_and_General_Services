"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Moon, Sun } from "lucide-react";
import {
  APPEARANCE_ACCENTS,
  APPEARANCE_DENSITIES,
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_THEMES,
  DEFAULT_APPEARANCE,
  type AppearanceAccent,
  type AppearanceDensity,
  type AppearancePreferences,
  type AppearanceTheme,
} from "@/lib/appearance";
import { applyFontSize, parseFontSize, type FontSizeLevel } from "@/lib/font-size";
import styles from "./appearance-settings.module.css";

const accentNames: Record<AppearanceAccent, string> = {
  sky: "Sky blue",
  blue: "Blue",
  royal: "Royal blue",
  cobalt: "Cobalt",
  navy: "Navy",
};

const themeNames: Record<AppearanceTheme, string> = {
  light: "Light",
  dark: "Dark",
};

const fontLabels: Record<Extract<FontSizeLevel, "small" | "medium" | "large">, string> = {
  small: "Small",
  medium: "Default",
  large: "Large",
};

function getFontSize() {
  return parseFontSize(document.documentElement.getAttribute("data-font-size"));
}

function subscribeFontSize(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-font-size"] });
  return () => observer.disconnect();
}

function readPreferences(): AppearancePreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? "{}") as Partial<AppearancePreferences>;
    return {
      theme: APPEARANCE_THEMES.includes(parsed.theme as AppearanceTheme) ? parsed.theme as AppearanceTheme : DEFAULT_APPEARANCE.theme,
      accent: APPEARANCE_ACCENTS.includes(parsed.accent as AppearanceAccent) ? parsed.accent as AppearanceAccent : DEFAULT_APPEARANCE.accent,
      density: APPEARANCE_DENSITIES.includes(parsed.density as AppearanceDensity) ? parsed.density as AppearanceDensity : DEFAULT_APPEARANCE.density,
      showAvatars: typeof parsed.showAvatars === "boolean" ? parsed.showAvatars : DEFAULT_APPEARANCE.showAvatars,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function applyPreferences(preferences: AppearancePreferences) {
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.accent = preferences.accent;
  root.dataset.density = preferences.density;
  root.dataset.showAvatars = String(preferences.showAvatars);
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Keep the current selection for this page even when storage is unavailable.
  }
}

export function AppearanceSettings() {
  const [preferences, setPreferences] = useState(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);
  const fontSize = useSyncExternalStore(subscribeFontSize, getFontSize, () => "medium");

  useEffect(() => {
    const saved = readPreferences();
    setPreferences(saved);
    applyPreferences(saved);
    setReady(true);
  }, []);

  function update<K extends keyof AppearancePreferences>(key: K, value: AppearancePreferences[K]) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    applyPreferences(next);
  }

  return (
    <section className={styles.section} aria-labelledby="appearance-title">
      <header className={styles.heading}>
        <h2 id="appearance-title">Appearance</h2>
        <p>Make MAZ look the way you like to work. Changes show on this device.</p>
      </header>

      <div className={styles.card}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Theme</legend>
          <div className={styles.themeOptions}>
            {APPEARANCE_THEMES.map((theme) => {
              const Icon = theme === "light" ? Sun : Moon;
              const previewStyle = theme === "light" ? styles.previewLight : styles.previewDark;
              return (
                <button
                  key={theme}
                  type="button"
                  className={styles.themeOption}
                  aria-label={`${themeNames[theme]} theme`}
                  aria-pressed={preferences.theme === theme}
                  onClick={() => update("theme", theme)}
                  disabled={!ready}
                >
                  <span className={`${styles.preview} ${previewStyle}`} aria-hidden="true">
                    <span /><span /><span />
                  </span>
                  <span className={styles.themeLabel}><Icon aria-hidden="true" />{themeNames[theme]}</span>
                  {preferences.theme === theme && <Check className={styles.themeCheck} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Accent <span className={styles.currentAccent}>{accentNames[preferences.accent]}</span></legend>
          <div className={styles.accentOptions}>
            {APPEARANCE_ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                className={`${styles.accentOption} ${preferences.accent === accent ? styles.accentSelected : ""}`}
                data-accent-option={accent}
                aria-label={`${accentNames[accent]} accent`}
                aria-pressed={preferences.accent === accent}
                onClick={() => update("accent", accent)}
                disabled={!ready}
              >
                {preferences.accent === accent && <Check aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.controlRow}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Density</legend>
            <div className={styles.segmented} role="group" aria-label="Layout density">
              {APPEARANCE_DENSITIES.map((density) => (
                <button key={density} type="button" aria-pressed={preferences.density === density}
                  onClick={() => update("density", density)} disabled={!ready}>
                  {density === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Text size</legend>
            <div className={`${styles.segmented} ${styles.textSize}`} role="group" aria-label="Text size">
              {(["small", "medium", "large"] as const).map((level) => (
                <button key={level} type="button" aria-pressed={fontSize === level}
                  onClick={() => applyFontSize(level)}>
                  {fontLabels[level]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className={styles.avatarRow}>
          <div>
            <strong>Show avatars in lists</strong>
            <p>Turn off for a quieter view</p>
          </div>
          <button
            className={styles.switch}
            type="button"
            role="switch"
            aria-checked={preferences.showAvatars}
            aria-label="Show avatars in lists"
            onClick={() => update("showAvatars", !preferences.showAvatars)}
            disabled={!ready}
          ><span /></button>
        </div>
      </div>
    </section>
  );
}
