import { NotificationCenter } from "@/components/notifications/notification-center";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "@/components/notifications/notification-center.module.css";

export default function ProviderNotificationsPage() {
  return (
    <section className={styles.page}>
      <PageHeading title="Notifications" description="Updates and alerts for your provider account." />
      <NotificationCenter />
    </section>
  );
}
