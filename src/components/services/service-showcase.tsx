import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import type { ServiceDetail, PortfolioPhoto, ServiceReview } from "@/lib/public/service-details";
import styles from "./service-showcase.module.css";

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 });

export function ServiceShowcase({ service, photos, reviews, customer }: {
  service: ServiceDetail; photos: PortfolioPhoto[]; reviews: ServiceReview[]; customer: boolean;
}) {
  const bookingPath = `/customer/bookings/new?service=${encodeURIComponent(service.id)}`;
  const signup = `/signup`;
  const login = `/login?next=${encodeURIComponent(bookingPath)}`;
  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length).toFixed(1) : null;
  return <article className={styles.page}>
    <Link href={customer ? "/customer/services" : "/#services"} className={styles.back}><ArrowLeft size={17} /> Back to services</Link>
    <header className={styles.heading}>
      <span className={styles.category}>{service.category}</span>
      <h1>{service.name}</h1>
      <p className={styles.price}>{service.starting_price_php == null ? "Price on quotation" : `Starting at ${money.format(service.starting_price_php)}`}</p>
      {service.price_note && <p>{service.price_note}</p>}
    </header>
    <section className={styles.panel} aria-labelledby="about-service">
      <h2 id="about-service">About this service</h2>
      <p>{service.description || "Tell us what you need. Our team will review your request and confirm the scope and quotation."}</p>
    </section>
    <section className={styles.panel} aria-labelledby="completed-work">
      <div className={styles.sectionTitle}><h2 id="completed-work">Photos of previous work</h2><span>Admin-curated portfolio</span></div>
      {photos.length ? <div className={styles.gallery}>{photos.map((photo) => <figure className={styles.photo} key={photo.id}>
        {/* Photos are uploaded by admins to the public portfolio bucket. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt={photo.caption || `Example of ${service.name} work`} loading="lazy" />
        {photo.caption && <figcaption>{photo.caption}</figcaption>}
      </figure>)}</div> : <p className={styles.empty}>No work photos have been published for this service yet.</p>}
    </section>
    <section className={styles.panel} aria-labelledby="customer-reviews">
      <div className={styles.sectionTitle}><h2 id="customer-reviews">Reviews from completed bookings</h2>
        {average && <span className={styles.rating}><Star size={16} fill="currentColor" /> {average} / 5 · {reviews.length} recent reviews</span>}
      </div>
      {reviews.length ? <div className={styles.reviews}>{reviews.map((review, index) => <div className={styles.review} key={`${review.created_at}-${index}`}>
        <div className={styles.stars} aria-label={`${review.stars} out of 5 stars`}>{"★".repeat(review.stars)}{"☆".repeat(5 - review.stars)}</div>
        {review.comment ? <p>{review.comment}</p> : <p className={styles.empty}>Rating only</p>}
        <small>{new Date(review.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" })}</small>
      </div>)}</div> : <p className={styles.empty}>No published reviews from completed bookings yet.</p>}
    </section>
    <div className={styles.actionPanel}>
      <p>Final scope and price are confirmed after review or inspection.</p>
      {customer ? <Link className={styles.primary} href={bookingPath}>Book a service</Link> : <div className={styles.actions}>
        <Link className={styles.primary} href={login}>Book a service · Log in</Link>
        <Link className={styles.secondary} href={signup}>New here? Register</Link>
      </div>}
    </div>
  </article>;
}
