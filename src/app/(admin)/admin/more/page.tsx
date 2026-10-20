import { MoreList } from "@/components/layout/more-list";
import styles from "@/components/ui/placeholder-screen.module.css";
import { PageHeading } from "@/components/layout/page-heading";

export default function AdminMore() {
  return (
    <section className={styles.screen}>
      <PageHeading title="More" description="Additional admin pages and tools." />
      <MoreList role="admin" />
    </section>
  );
}
