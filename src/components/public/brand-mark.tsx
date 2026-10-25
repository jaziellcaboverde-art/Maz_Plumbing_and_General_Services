import Image from "next/image";
import styles from "./brand-mark.module.css";

/** The MAZ logo as a round mark. Size comes from the parent through the --brand-size variable. */
export function BrandMark({ priority = false }: { priority?: boolean }) {
  return (
    <span className={styles.mark}>
      <Image
        className={styles.image}
        src="/maz-plumbing-logo.jpg"
        alt=""
        fill
        sizes="(min-width: 48rem) 14rem, 10rem"
        priority={priority}
      />
    </span>
  );
}
