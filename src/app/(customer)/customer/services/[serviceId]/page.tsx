import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

const MONEY = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default async function CustomerServiceDetail({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/customer/services/${serviceId}`)}`);
  const { data: service, error } = await supabase.from("services")
    .select("id,category,name,description,starting_price_php,price_note")
    .eq("id", serviceId).eq("active", true).maybeSingle();
  if (error) throw new Error("Could not load the service details.", { cause: error });
  if (!service) notFound();

  return <section className={styles.page}>
    <Link className={styles.back} href="/customer"><ArrowLeft size={18} aria-hidden="true" />Back to services</Link>
    <PageHeading title={service.name} description={service.category} />
    <p className={styles.price}>{service.starting_price_php == null
      ? "Price on quote"
      : `From ${MONEY.format(Number(service.starting_price_php))}`}</p>
    {service.price_note && <p className={styles.priceNote}>{service.price_note}</p>}
    <div className={styles.description}>
      <h2>About this service</h2>
      <p>{service.description || "Our team will confirm the service details and quote after reviewing your request."}</p>
    </div>
    <p className={styles.notice}>Final price is confirmed after inspection or quote. Any deposit is held in the system.</p>
    <Link className={styles.support} href={`/customer/chat?support=1&topic=${encodeURIComponent(service.name)}`}>
      <MessageCircle size={18} aria-hidden="true" />Chat with support about this service
    </Link>
    <div className={styles.sticky}>
      <Link className={styles.book} href={`/customer/bookings/new?service=${service.id}`}>Book this service</Link>
    </div>
  </section>;
}
