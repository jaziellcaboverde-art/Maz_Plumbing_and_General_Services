import { FontSizeControl } from "./font-size-control";
import styles from "./settings-screen.module.css";

/** Settings for every role. Phase 5 adds account, payout and consent sections. */
export function SettingsScreen() {
  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Settings</h1>
      <section id="text-size" className={styles.section}>
        <FontSizeControl />
      </section>
    </div>
  );
}
