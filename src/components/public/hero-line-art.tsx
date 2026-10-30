import styles from "./hero-line-art.module.css";

/**
 * The line drawings behind the logo on the guest home page: rings, a wrench, a bolt, a drop and a pipe.
 * Decorative only. Colors and stroke sizes come from the CSS module (tokens), not from this file.
 */
export function HeroLineArt() {
  return (
    <svg className={styles.art} viewBox="0 0 560 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <circle className={styles.soft} cx="280" cy="250" r="260" />
      <circle className={styles.soft} cx="280" cy="250" r="215" />
      <circle className={styles.dashed} cx="280" cy="250" r="170" />
      <g transform="translate(402 18) rotate(35)">
        <path className={styles.solid} d="M0 0a22 22 0 1 1 18 36l-6 110a10 10 0 0 1-20 0l-6-110A22 22 0 0 1 0 0z" />
        <circle className={styles.hole} cx="0" cy="-2" r="8" />
      </g>
      <path className={styles.solid} transform="translate(0 20)" d="M62 120l34-18l-10 36l32-14l-46 66l10-44l-32 18z" />
      <path className={styles.solid} d="M470 388c0 0-26 32-26 52a26 26 0 0 0 52 0c0-20-26-52-26-52z" />
      <path className={styles.pipeBody} d="M36 470v-62a26 26 0 0 1 26-26h58" />
      <path className={styles.line} d="M36 470v-62a26 26 0 0 1 26-26h58" />
    </svg>
  );
}
