"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, MapPin, Search, UserRound, X } from "lucide-react";
import { STATUS_LABELS, type BookingStatus } from "@/lib/booking/rules";
import styles from "./provider-schedule-directory.module.css";

export type DirectoryService = {
  id: string;
  name: string;
  category: string | null;
};

export type DirectoryBooking = {
  id: string;
  service: string;
  customer: string;
  area: string;
  description: string | null;
  urgent: boolean;
  startsAt: string | null;
  status: string;
};

export type DirectoryProvider = {
  id: string;
  name: string;
  services: DirectoryService[];
  bookings: DirectoryBooking[];
};

const PROVIDERS_PER_PAGE = 9;

export function ProviderScheduleDirectory({
  providers,
  services,
}: {
  providers: DirectoryProvider[];
  services: DirectoryService[];
}) {
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<DirectoryProvider | null>(null);
  const serviceOptions = useMemo(() => [...services].sort((a, b) => serviceLabel(a).localeCompare(serviceLabel(b))), [services]);
  const filteredProviders = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return [...providers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((provider) => {
        if (serviceFilter && !provider.services.some((service) => service.id === serviceFilter)) return false;
        if (!needle) return true;
        return [
          provider.name,
          ...provider.services.map(serviceLabel),
          ...provider.bookings.flatMap((booking) => [booking.service, booking.customer, booking.area]),
        ].join(" ").toLocaleLowerCase().includes(needle);
      });
  }, [providers, search, serviceFilter]);
  const pageCount = Math.ceil(filteredProviders.length / PROVIDERS_PER_PAGE);
  const visibleProviders = filteredProviders.slice(
    (currentPage - 1) * PROVIDERS_PER_PAGE,
    currentPage * PROVIDERS_PER_PAGE,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Operations</p>
          <h1>Provider schedules</h1>
          <p className={styles.subtitle}>Find a provider and review upcoming bookings and active work.</p>
        </div>
        <span className={styles.scheduleLabel}>Upcoming &amp; active</span>
      </header>

      <section className={styles.toolbar} aria-label="Find providers">
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <span className={styles.srOnly}>Search providers, services, customers, or service areas</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search providers, services, or customers"
          />
        </label>
        <label className={styles.filter}>
          <span>Service</span>
          <select
            value={serviceFilter}
            onChange={(event) => {
              setServiceFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All services</option>
            {serviceOptions.map((service) => <option value={service.id} key={service.id}>{serviceLabel(service)}</option>)}
          </select>
        </label>
        <p className={styles.resultCount} aria-live="polite">{filteredProviders.length} of {providers.length} providers</p>
      </section>

      {filteredProviders.length ? (
        <section className={styles.grid} aria-label="Providers">
          {visibleProviders.map((provider) => {
            const activeJobs = provider.bookings.filter((booking) => booking.status === "in_progress");
            const upcomingJobs = provider.bookings.filter((booking) => booking.status !== "in_progress");
            const nextJob = upcomingJobs.find((booking) => booking.startsAt) ?? upcomingJobs[0];
            return (
              <button
                type="button"
                className={styles.providerCard}
                key={provider.id}
                onClick={() => setSelectedProvider(provider)}
                aria-haspopup="dialog"
                aria-label={`View schedule for ${provider.name}`}
              >
                <span className={styles.cardTop}>
                  <span className={styles.avatar} aria-hidden="true">{initials(provider.name)}</span>
                  {activeJobs.length > 0 && <span className={styles.activeBadge}><span /> Working now</span>}
                </span>
                <span className={styles.providerName}>{provider.name}</span>
                <span className={styles.serviceList}>
                  {provider.services.length
                    ? provider.services.slice(0, 3).map((service) => <span className={styles.serviceTag} key={service.id}>{service.name}</span>)
                    : <span className={styles.noServices}>No approved services listed</span>}
                  {provider.services.length > 3 && <span className={styles.moreServices}>+{provider.services.length - 3} more</span>}
                </span>
                <span className={styles.cardDivider} />
                <span className={styles.cardSummary}>
                  <span><b>{upcomingJobs.length}</b> upcoming</span>
                  {activeJobs.length > 0 && <span className={styles.activeCount}><b>{activeJobs.length}</b> in progress</span>}
                </span>
                {activeJobs[0] ? (
                  <span className={styles.nextJob}>
                    <span className={styles.jobLabel}>Current job</span>
                    <b>{activeJobs[0].service}</b>
                    <span>{activeJobs[0].customer}</span>
                  </span>
                ) : nextJob ? (
                  <span className={styles.nextJob}>
                    <span className={styles.jobLabel}>Next booking</span>
                    <b>{nextJob.service}</b>
                    <span>{nextJob.startsAt ? formatDate(nextJob.startsAt) : "Date not set"}</span>
                  </span>
                ) : (
                  <span className={styles.nextJob}><span className={styles.jobLabel}>Schedule</span><span>No upcoming bookings</span></span>
                )}
                <span className={styles.viewLink}>View provider schedule <span aria-hidden="true">→</span></span>
              </button>
            );
          })}
        </section>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><UserRound size={22} aria-hidden="true" /></span>
          <h2>{providers.length ? "No providers match your filters" : "No approved providers yet"}</h2>
          <p>{providers.length ? "Try a different search or service." : "Approved providers will appear here with their bookings."}</p>
        </div>
      )}

      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Provider pages">
          <span className={styles.pageSummary}>
            Showing {(currentPage - 1) * PROVIDERS_PER_PAGE + 1}–{Math.min(currentPage * PROVIDERS_PER_PAGE, filteredProviders.length)} of {filteredProviders.length}
          </span>
          <div className={styles.pageControls}>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </button>
            <span className={styles.pageNumber} aria-current="page">Page {currentPage} of {pageCount}</span>
            <button
              type="button"
              className={styles.pageButton}
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}

      {selectedProvider && (
        <ProviderScheduleDialog provider={selectedProvider} onDismiss={() => setSelectedProvider(null)} />
      )}
    </div>
  );
}

function ProviderScheduleDialog({ provider, onDismiss }: { provider: DirectoryProvider; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cleanupCloseEvents = useRef(0);
  const activeJobs = provider.bookings.filter((booking) => booking.status === "in_progress");
  const upcomingJobs = provider.bookings.filter((booking) => booking.status !== "in_progress");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) {
        cleanupCloseEvents.current += 1;
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="provider-dialog-title"
      onClose={() => {
        if (cleanupCloseEvents.current > 0) {
          cleanupCloseEvents.current -= 1;
          return;
        }
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <header className={styles.dialogHeader}>
        <div className={styles.dialogIdentity}>
          <span className={styles.avatar} aria-hidden="true">{initials(provider.name)}</span>
          <div>
            <p className={styles.eyebrow}>Provider schedule</p>
            <h2 id="provider-dialog-title">{provider.name}</h2>
          </div>
        </div>
        <button type="button" className={styles.closeButton} aria-label="Close schedule" onClick={() => dialogRef.current?.close()}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className={styles.dialogBody}>
        <section className={styles.dialogServices}>
          <h3>Approved services</h3>
          <div className={styles.serviceList}>
            {provider.services.length
              ? provider.services.map((service) => <span className={styles.serviceTag} key={service.id}>{serviceLabel(service)}</span>)
              : <span className={styles.noServices}>No approved services listed</span>}
          </div>
        </section>

        {activeJobs.length > 0 && (
          <section className={styles.jobSection}>
            <div className={styles.sectionHeading}>
              <h3>In progress now</h3>
              <span className={styles.liveBadge}><span /> {activeJobs.length} active</span>
            </div>
            <ul className={styles.jobList}>{activeJobs.map((booking) => <BookingCard booking={booking} key={booking.id} />)}</ul>
          </section>
        )}

        <section className={styles.jobSection}>
          <div className={styles.sectionHeading}>
            <h3>Upcoming bookings</h3>
            <span className={styles.bookingCount}>{upcomingJobs.length}</span>
          </div>
          {upcomingJobs.length
            ? <ul className={styles.jobList}>{upcomingJobs.map((booking) => <BookingCard booking={booking} key={booking.id} />)}</ul>
            : <p className={styles.dialogEmpty}>No upcoming bookings in this schedule window.</p>}
        </section>
      </div>
    </dialog>
  );
}

function BookingCard({ booking }: { booking: DirectoryBooking }) {
  return (
    <li className={styles.bookingCard}>
      <div className={styles.bookingTitle}>
        <h4>{booking.service}</h4>
        <span className={styles.status} data-status={booking.status}>{statusLabel(booking.status)}</span>
      </div>
      <dl className={styles.bookingDetails}>
        <div><dt><Clock3 size={14} aria-hidden="true" /> Appointment</dt><dd>{booking.status === "in_progress" ? "In progress now" : booking.startsAt ? formatDate(booking.startsAt) : "Date not set"}</dd></div>
        <div><dt><UserRound size={14} aria-hidden="true" /> Customer</dt><dd>{booking.customer}</dd></div>
        <div><dt><MapPin size={14} aria-hidden="true" /> Service area</dt><dd>{booking.area}</dd></div>
      </dl>
      {booking.urgent && <p className={styles.urgent}>Urgent booking</p>}
      {booking.description && <p className={styles.description}>{booking.description}</p>}
    </li>
  );
}

function serviceLabel(service: DirectoryService) {
  return service.category ? `${service.category} — ${service.name}` : service.name;
}

function statusLabel(status: string) {
  return (STATUS_LABELS as Partial<Record<BookingStatus, string>>)[status as BookingStatus] ?? status.replaceAll("_", " ");
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
