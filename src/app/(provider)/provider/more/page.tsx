import { MoreList } from "@/components/layout/more-list";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "@/components/ui/placeholder-screen.module.css";

export default function ProviderMore() {
  return <section className={styles.screen}><PageHeading title="More" description="Availability, history, profile and other provider tools." /><MoreList role="provider" /></section>;
}
