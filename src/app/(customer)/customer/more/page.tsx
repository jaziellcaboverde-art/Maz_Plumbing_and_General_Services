import { MoreList } from "@/components/layout/more-list";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "@/components/ui/placeholder-screen.module.css";

export default function CustomerMore() {
  return <section className={styles.screen}><PageHeading title="More" description="Profile, history, chat and other customer tools." /><MoreList role="customer" /></section>;
}
