"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { ServiceShowcase } from "./service-showcase";
import type { ServiceDetail, PortfolioPhoto, ServiceReview } from "@/lib/public/service-details";

type Details = { service: ServiceDetail; photos: PortfolioPhoto[]; reviews: ServiceReview[] };

export function ServiceCardLink({ href, className, children, name, customer = false }: {
  href: string; className?: string; children: ReactNode; name: string; customer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open || details) return;
    const controller = new AbortController();
    fetch(`/api/services/${encodeURIComponent(href.split("/").at(-1)!)}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Unavailable"); return response.json(); })
      .then(setDetails)
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, href, details]);
  return <>
    <Link href={href} className={className} onClick={event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      setError(false);
      setOpen(true);
    }}>{children}</Link>
    {open && <Modal open={open} onClose={() => setOpen(false)} title={name}>
      {details ? <ServiceShowcase {...details} customer={customer} embedded /> : error
        ? <p role="alert">Unable to load the service. <Link href={href}>Open service details</Link> or close and try again.</p>
        : <p role="status">Loading service details, photos and reviews…</p>}
    </Modal>}
  </>;
}
