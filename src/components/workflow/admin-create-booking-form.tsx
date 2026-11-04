"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { manilaInputToISO } from "@/lib/provider/time";
import styles from "./workflow.module.css";

type Option = { value: string; label: string };

export function AdminCreateBookingForm({
  customers,
  addresses,
  services,
}: {
  customers: Option[];
  addresses: Option[];
  services: Option[];
}) {
  const [mode, setMode] = useState<"manual" | "registered">("manual");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const toast = useToast();

  return (
    <form
      className={`${styles.form} ${styles.intakeForm}`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const start = manilaInputToISO(String(form.get("start") ?? ""));
        if (!start) {
          setMessage("Enter a valid requested date and time.");
          return;
        }
        const data: Record<string, string> = {
          serviceId: String(form.get("serviceId") ?? ""),
          source: String(form.get("source") ?? ""),
          description: String(form.get("description") ?? ""),
          start,
        };
        if (mode === "registered") {
          data.customerId = String(form.get("customerId") ?? "");
          data.addressId = String(form.get("addressId") ?? "");
        } else {
          data.customerName = String(form.get("customerName") ?? "");
          data.customerMobile = String(form.get("customerMobile") ?? "");
          data.customerAddress = String(form.get("customerAddress") ?? "");
        }
        setBusy(true);
        setMessage("");
        try {
          const response = await fetch("/api/admin/workflow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "create", data }),
          });
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.error ?? "Check the request details and try again.");
            return;
          }
          toast.show({ status: "success", message: "Customer request recorded." });
          router.push(`/admin/bookings/${result.id}`);
          router.refresh();
        } catch {
          setMessage("Could not reach MAZ. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className={styles.intakeSection}>
        <legend>Customer details</legend>
        <div className={styles.intakeFields}>
          <label className={styles.intakeFieldWide}>
            Customer type
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="manual">Customer contacted MAZ directly</option>
              <option value="registered">Customer has an account</option>
            </select>
          </label>
          {mode === "registered" ? (
            <>
              <label>
                Customer
                <select name="customerId" required>
                  <option value="">Choose customer</option>
                  {customers.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Customer&apos;s saved service address
                <select name="addressId" required>
                  <option value="">
                    Choose the customer&apos;s pinned address
                  </option>
                  {addresses.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Customer name
                <input
                  name="customerName"
                  autoComplete="name"
                  required
                  maxLength={160}
                  placeholder="Enter customer name"
                />
              </label>
              <label>
                Customer mobile number
                <input
                  name="customerMobile"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={32}
                  placeholder="+63 9XX XXX XXXX"
                />
              </label>
              <label className={styles.intakeFieldWide}>
                Service address
                <textarea
                  name="customerAddress"
                  required
                  maxLength={500}
                  placeholder="House/building, street, barangay, city or municipality, province"
                />
              </label>
              <p className={`${styles.muted} ${styles.intakeNotice}`}>
                This request is saved for MAZ review. Confirm service coverage
                and location before assigning a team.
              </p>
            </>
          )}
        </div>
      </fieldset>

      <fieldset className={styles.intakeSection}>
        <legend>Service request</legend>
        <div className={styles.intakeFields}>
          <label>
            Service
            <select name="serviceId" required defaultValue="">
              <option value="">Choose service</option>
              {services.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            How did the customer contact MAZ?
            <select name="source" defaultValue="phone">
              <option value="phone">Phone</option>
              <option value="facebook">Facebook</option>
              <option value="walk_in">Walk-in</option>
              <option value="referral">Referral</option>
            </select>
          </label>
          <label className={styles.intakeFieldWide}>
            Reported issue, scope and customer instructions
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={4000}
              placeholder="Describe the issue, requested work, availability and access instructions."
            />
          </label>
          <label>
            Requested date and time (Philippines)
            <input name="start" type="datetime-local" required />
          </label>
        </div>
      </fieldset>
      {message && (
        <p className={styles.intakeError} role="alert">
          {message}
        </p>
      )}
      <div className={styles.intakeActions}>
        <Button type="submit" variant="primary" loading={busy} disabled={busy}>
          Record customer request
        </Button>
      </div>
    </form>
  );
}
