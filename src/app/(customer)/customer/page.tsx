import Link from "next/link";
import { PageHeading } from "@/components/layout/page-heading";
import styles from "./bookings/page.module.css";

export default function CustomerHome() {
  return (
    <section className={styles.page}>
      <PageHeading title="Home" description="Book a service or check on a request you already made." />
      <div className={styles.list}>
        <Link className={styles.primaryLink} href="/customer/bookings/new">Book a service</Link>
        <Link className={styles.itemLink} href="/customer/bookings">See my bookings</Link>
      </div>
    </section>
  );
}
