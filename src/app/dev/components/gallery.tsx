"use client";

import { useState, type ReactNode } from "react";
import { CalendarX } from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { Input } from "@/components/ui/input";
import { List } from "@/components/ui/list";
import { Modal } from "@/components/ui/modal";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { ToastProvider, useToast } from "@/components/ui/toast";
import styles from "./gallery.module.css";

type Booking = { id: string; customer: string; service: string; deposit: string };

const BOOKINGS: Booking[] = [
  { id: "1", customer: "Ana Reyes", service: "Plumbing", deposit: "P2,000" },
  { id: "2", customer: "Ben Santos", service: "Electrical", deposit: "P1,500" },
  { id: "3", customer: "Carla Lim", service: "Painting", deposit: "P15,000" },
  { id: "4", customer: "Dan Cruz", service: "Roofing", deposit: "P24,000" },
  { id: "5", customer: "Eli Tan", service: "Aircon repair", deposit: "P800" },
];

const COLUMNS: Column<Booking>[] = [
  { key: "customer", header: "Customer", render: (r) => r.customer },
  { key: "service", header: "Service", render: (r) => r.service },
  { key: "deposit", header: "Deposit", render: (r) => r.deposit, numeric: true },
];

const STEPS = [
  { id: "service", label: "Service" },
  { id: "provider", label: "Provider" },
  { id: "details", label: "Details" },
  { id: "deposit", label: "Pay deposit" },
];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {note && <p className={styles.caption}>{note}</p>}
      <div className={styles.row}>{children}</div>
    </section>
  );
}

function ToastButtons() {
  const toast = useToast();
  return (
    <ButtonGroup>
      <Button variant="primary" onClick={() => toast.show({ status: "success", message: "Request sent" })}>
        Send request
      </Button>
      <Button onClick={() => toast.show({ status: "error", message: "Request not sent. Check your connection and try again." })}>
        Show error
      </Button>
      <Button onClick={() => toast.show({ status: "warning", message: "Your session ends in 5 minutes." })}>Show warning</Button>
      <Button onClick={() => toast.show({ status: "info", message: "Ana accepted your offer." })}>Show note</Button>
    </ButtonGroup>
  );
}

export function ComponentGallery() {
  const [modalOpen, setModalOpen] = useState(false);
  const [method, setMethod] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState<string>();

  return (
    <ToastProvider>
      <main className={styles.page}>
        <h1 className={styles.heading}>Base components</h1>
        <p className={styles.caption}>
          Step 1.21 review page. Change the text size below and check that nothing is cropped or overlapping. Only shown in development.
        </p>

        <FontSizeControl />

        <Section title="Buttons" note="Default, loading and disabled with a reason. Tab to see the focus ring.">
          <ButtonGroup>
            <Button variant="primary">Pay deposit</Button>
            <Button>Cancel</Button>
          </ButtonGroup>
          <Button variant="primary" loading>
            Save changes
          </Button>
          <Button id="gallery-disabled" variant="primary" disabled disabledReason="Choose a payment method first.">
            Pay deposit
          </Button>
          <Button disabled>Cancel</Button>
        </Section>

        <Section title="Inputs">
          <Input label="Mobile number" hint="We text a code to this number." />
          <Input label="Mobile number" defaultValue="0917" status="error" message="Enter 11 digits, starting with 09." />
          <Input label="Mobile number" defaultValue="09171234567" status="success" message="Number verified." />
          <Input label="Mobile number" defaultValue="09171234567" status="loading" message="Checking number" />
          <Input label="Mobile number" defaultValue="09171234567" disabled />
          <Select label="Service">
            <option value="">Choose a service</option>
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
          </Select>
          <Select label="Service" status="error" message="Choose a service to continue.">
            <option value="">Choose a service</option>
          </Select>
        </Section>

        <Section title="Checkbox and radio">
          <Checkbox label="I agree to the Terms" />
          <Checkbox label="I agree to the Terms" defaultChecked />
          <Checkbox label="I agree to the Terms" error="Agree to the Terms to create an account." />
          <Checkbox label="I agree to the Terms" disabled />
          <RadioGroup
            legend="Payment method"
            name="gallery-method"
            value={method}
            onChange={setMethod}
            options={[
              { value: "gcash", label: "GCash" },
              { value: "card", label: "Card", hint: "Visa or Mastercard" },
              { value: "bank", label: "Bank transfer", disabled: true },
            ]}
          />
          <RadioGroup
            legend="Payment method"
            name="gallery-method-error"
            value={null}
            onChange={() => {}}
            error="Choose a payment method."
            options={[
              { value: "gcash", label: "GCash" },
              { value: "card", label: "Card" },
            ]}
          />
        </Section>

        <Section title="Modal and toast" note="The modal is small because the question is small.">
          <Button onClick={() => setModalOpen(true)}>Cancel booking</Button>
          <ToastButtons />
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Cancel this booking?"
            footer={
              <ButtonGroup>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Cancel booking
                </Button>
                <Button onClick={() => setModalOpen(false)}>Keep booking</Button>
              </ButtonGroup>
            }
          >
            <p>You get back P500 of your P2,000 deposit.</p>
          </Modal>
        </Section>

        <Section title="Table" note="For 5 or more rows. Amounts are right aligned.">
          <DataTable caption="Bookings" columns={COLUMNS} rows={BOOKINGS} getRowKey={(r) => r.id} />
          <DataTable caption="Bookings, loading" columns={COLUMNS} rows={[]} getRowKey={(r) => r.id} loading />
          <DataTable
            caption="Bookings, error"
            columns={COLUMNS}
            rows={[]}
            getRowKey={(r) => r.id}
            error="Bookings did not load. Refresh the page."
          />
          <DataTable
            caption="Bookings, empty"
            columns={COLUMNS}
            rows={[]}
            getRowKey={(r) => r.id}
            empty={<EmptyState icon={CalendarX} title="No bookings yet." description="New bookings appear here." />}
          />
        </Section>

        <Section title="List" note="For fewer than 5 records.">
          <List
            label="Providers"
            items={[
              { id: "1", title: "Ana R.", description: "4.8 rating, 2.1 km", trailing: "P1,200 per day", onSelect: () => {} },
              { id: "2", title: "Ben T.", description: "4.6 rating, 3.4 km", trailing: "P1,000 per day", onSelect: () => {} },
              { id: "3", title: "Carl D.", description: "Not available this week", onSelect: () => {}, disabled: true },
              { id: "4", title: "Receipt", description: "Paid 3 October", trailing: "P2,000", href: "#receipt" },
            ]}
          />
          <List label="Payments" items={[]} loading />
          <List label="Payments" items={[]} error="Payments did not load. Refresh the page." />
          <List label="Bookings" items={[]} empty={<EmptyState title="No bookings yet. Book a service." action={<Button variant="primary">Book a service</Button>} />} />
        </Section>

        <Section title="Stepper" note="Only for real sequences: sign up, booking, quote, signature.">
          <Stepper steps={STEPS} current={step} label="Booking progress" />
          <ButtonGroup>
            <Button variant="primary" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))} disabled={step === STEPS.length - 1}>
              Next step
            </Button>
            <Button onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}>
              Back
            </Button>
          </ButtonGroup>
          <Stepper steps={[{ ...STEPS[0], error: true }, ...STEPS.slice(1)]} current={2} label="Booking progress with an error" />
        </Section>

        <Section title="File upload" note="Try a file over 5 MB or a type that is not allowed.">
          <FileUpload
            label="Government ID"
            hint="JPG, PNG or PDF, up to 5 MB"
            accept=".pdf,image/jpeg,image/png"
            acceptLabel="a JPG, PNG or PDF"
            maxBytes={5 * 1024 * 1024}
            fileName={fileName}
            onSelect={(file) => setFileName(file.name)}
            onRemove={() => setFileName(undefined)}
          />
          <FileUpload label="Government ID" progress={40} onSelect={() => {}} />
          <FileUpload label="Government ID" error="Upload failed. Check your connection and try again." onSelect={() => {}} />
          <FileUpload label="Government ID" disabled onSelect={() => {}} />
        </Section>
      </main>
    </ToastProvider>
  );
}
