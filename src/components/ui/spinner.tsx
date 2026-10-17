import { LoaderCircle } from "lucide-react";
import styles from "./spinner.module.css";

/** Loading indicator. The text next to it says what is loading. */
export function Spinner() {
  return <LoaderCircle className={styles.spinner} aria-hidden="true" />;
}
