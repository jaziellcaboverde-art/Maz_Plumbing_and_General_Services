import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "./page.module.css";

export default function AdminNotificationsPage() {
  return (
    <section className={styles.page}>
      <PageHeading title="Notifications" description="Updates and alerts for your admin account." />
      <NotificationCenter />
    </section>
  );
}
