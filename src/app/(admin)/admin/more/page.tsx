import { MoreList } from "@/components/layout/more-list";
import styles from "@/components/ui/placeholder-screen.module.css";

export default function AdminMore() {
  return (
    <section>
      <h1 className={styles.title}>More</h1>
      <MoreList role="admin" />
    </section>
  );
}
