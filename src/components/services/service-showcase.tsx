import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import type {
  ServiceDetail,
  PortfolioPhoto,
  ServiceReview,
} from "@/lib/public/service-details";
import styles from "./service-showcase.module.css";
import { EmptyState } from "@/components/ui/empty-state";
import { Images, MessageSquare } from "lucide-react";
import { ServiceImage } from "./service-image";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export function ServiceShowcase({
  service,
  photos,
  reviews,
  customer,
  embedded = false,
}: {
  service: ServiceDetail;
  photos: PortfolioPhoto[];
  reviews: ServiceReview[];
  customer: boolean;
  embedded?: boolean;
}) {
  const bookingPath = /^[0-9a-f-]{36}$/i.test(service.id)
    ? `/customer/bookings/new?service=${encodeURIComponent(service.id)}`
    : "/customer/bookings/new";
  const signup = /^[0-9a-f-]{36}$/i.test(service.id)
    ? `/signup?service=${encodeURIComponent(service.id)}`
    : "/signup";
  const login = `/login?next=${encodeURIComponent(bookingPath)}`;
  const average = reviews.length
    ? (
        reviews.reduce((sum, review) => sum + review.stars, 0) / reviews.length
      ).toFixed(1)
    : null;
  return (
    <article className={styles.page} data-embedded={embedded}>
      {!embedded && (
        <Link
          href={customer ? "/customer/services" : "/#services"}
          className={styles.back}
        >
          <ArrowLeft className={styles.ratingIcon} /> Back to services
        </Link>
      )}
      <header className={styles.heading}>
        {service.imageUrl && (
          <ServiceImage
            className={styles.cover}
            src={service.imageUrl}
            alt={service.name}
          />
        )}
        <span className={styles.category}>{service.category}</span>
        <h1>{service.name}</h1>
        <p className={styles.price}>
          {service.starting_price_php == null
            ? "Price on quotation"
            : `Starting at ${money.format(service.starting_price_php)}`}
        </p>
        {service.price_note && <p>{service.price_note}</p>}
      </header>
      <section className={styles.panel} aria-labelledby="about-service">
        <h2 id="about-service">About this service</h2>
        <p>
          {service.description ||
            "Tell us what you need. Our team will review your request and confirm the scope and quotation."}
        </p>
      </section>
      <section className={styles.panel} aria-labelledby="completed-work">
        <div className={styles.sectionTitle}>
          <h2 id="completed-work">Service portfolio</h2>
          <span>Project photos</span>
        </div>
        {photos.length ? (
          <div className={styles.gallery}>
            {photos.map((photo) => (
              <figure className={styles.photo} key={photo.id}>
                <a
                  href={photo.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open photo: ${photo.caption || service.name} (new tab)`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.caption || `Example of ${service.name} work`}
                    loading="lazy"
                  />
                </a>
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Images}
            title="Portfolio coming soon"
            description="MAZ has not published work photos for this service yet."
          />
        )}
      </section>
      <section className={styles.panel} aria-labelledby="customer-reviews">
        <div className={styles.sectionTitle}>
          <h2 id="customer-reviews">Customer reviews</h2>
          {average && (
            <span className={styles.rating}>
              <Star className={styles.actionIcon} fill="currentColor" />{" "}
              {average} / 5 · {reviews.length} recent reviews
            </span>
          )}
        </div>
        {reviews.length ? (
          <div className={styles.reviews}>
            {reviews.map((review, index) => (
              <div
                className={styles.review}
                key={`${review.created_at}-${index}`}
              >
                <div
                  className={styles.stars}
                  aria-label={`${review.stars} out of 5 stars`}
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={styles.actionIcon}
                      aria-hidden="true"
                      fill={index < review.stars ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                {review.comment ? (
                  <p>{review.comment}</p>
                ) : (
                  <p className={styles.empty}>Rating only</p>
                )}
                <small>
                  {new Date(review.created_at).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: "Asia/Manila",
                  })}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="No published reviews yet"
            description="Reviews appear after completed bookings and customer permission."
          />
        )}
      </section>
      <div className={styles.actionPanel}>
        <p>Final scope and price are confirmed after review or inspection.</p>
        {customer ? (
          <Link className={styles.primary} href={bookingPath}>
            Book a service
          </Link>
        ) : (
          <div className={styles.actions}>
            <Link className={styles.primary} href={login}>
              Book a service · Log in
            </Link>
            <Link className={styles.secondary} href={signup}>
              New here? Register
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
