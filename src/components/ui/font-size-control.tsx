"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_LABELS,
  FONT_SIZE_LEVELS,
  applyFontSize,
  parseFontSize,
} from "@/lib/font-size";
import styles from "./font-size-control.module.css";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-font-size"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () =>
  parseFontSize(document.documentElement.getAttribute("data-font-size"));

const getServerSnapshot = () => DEFAULT_FONT_SIZE;

/** Text size setting, four levels, all roles. Reused by Settings in Phase 5. */
export function FontSizeControl() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Text size</legend>
      <div className={styles.options}>
        {FONT_SIZE_LEVELS.map((level) => (
          <label key={level} className={styles.item}>
            <input
              className={styles.input}
              type="radio"
              name="font-size"
              value={level}
              checked={current === level}
              onChange={() => applyFontSize(level)}
            />
            {FONT_SIZE_LABELS[level]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
