"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import styles from "./service-catalog.module.css";

type Service = {
  id: string;
  category: string;
  name: string;
  default_class: "minor" | "major";
  urgent_allowed: boolean;
  active: boolean;
  sort_order: number;
};

export function ServiceCatalog({ initialServices }: { initialServices: Service[] }) {
  const addFormId = useId();
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addFormVersion, setAddFormVersion] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredServices = services.filter((service) =>
    `${service.category} ${service.name}`.toLocaleLowerCase().includes(normalizedSearch),
  );

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setAdding(true); setAddError(null);
    try {
      const response = await fetch("/api/admin/services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.get("category"), name: form.get("name"), defaultClass: form.get("default_class"),
          urgentAllowed: form.get("urgent_allowed") === "on", active: true, sortOrder: Number(form.get("sort_order") || 0),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not add the service.");
      setServices((current) => [...current, result.service].sort((a, b) => a.sort_order - b.sort_order || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
      formElement.reset();
      setAddOpen(false);
    } catch (caught) { setAddError(caught instanceof Error ? caught.message : "Could not add the service."); }
    finally { setAdding(false); }
  }

  function update(updated: Service) {
    setServices((current) => current.map((service) => service.id === updated.id ? updated : service)
      .sort((a, b) => a.sort_order - b.sort_order || a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
  }

  return <div className={styles.catalog}>
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Input
          label="Search services"
          name="service_search"
          type="search"
          autoComplete="off"
          placeholder="Search by service or category"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <Button type="button" variant="primary" onClick={() => { setAddError(null); setAddFormVersion((version) => version + 1); setAddOpen(true); }}>Add service</Button>
    </div>
    <Modal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      title="Add a service"
      error={addError ?? undefined}
      footer={
        <ButtonGroup>
          <Button type="submit" form={addFormId} variant="primary" loading={adding} disabled={adding}>Add service</Button>
          <Button type="button" onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
        </ButtonGroup>
      }
    >
      <form key={addFormVersion} id={addFormId} className={styles.editForm} onSubmit={add}>
        <div className={styles.fields}>
          <Input label="Category" name="category" maxLength={80} required />
          <Input label="Service name" name="name" maxLength={120} required />
          <Select label="Default job class" name="default_class" defaultValue="minor">
            <option value="minor">Minor</option><option value="major">Major</option>
          </Select>
          <Input label="Display order" name="sort_order" type="number" min="0" step="1" defaultValue="0" required />
        </div>
        <label className={styles.flag}><input type="checkbox" name="urgent_allowed" /> Allow urgent requests</label>
      </form>
    </Modal>
    {!services.length && <p>No services yet. Add a service once the launch list is confirmed.</p>}
    {services.length > 0 && filteredServices.length === 0
      ? <p role="status">No services match your search.</p>
      : <ul className={styles.list}>
        {filteredServices.map((service) => <li key={service.id}><ServiceRow service={service} onSaved={update} /></li>)}
      </ul>}
  </div>;
}

function ServiceRow({ service, onSaved }: { service: Service; onSaved: (service: Service) => void }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ status: "success" | "error"; text: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/services", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: service.id, category: form.get("category"), name: form.get("name"), defaultClass: form.get("default_class"),
          urgentAllowed: form.get("urgent_allowed") === "on", active: form.get("active") === "on", sortOrder: Number(form.get("sort_order") || 0),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save the service.");
      onSaved(result.service);
      setMessage({ status: "success", text: "Service saved." });
    } catch (caught) { setMessage({ status: "error", text: caught instanceof Error ? caught.message : "Could not save the service." }); }
    finally { setBusy(false); }
  }

  return <>
    <div className={styles.serviceRow}>
      <span className={styles.serviceName}>{service.name}</span>
      <Button type="button" onClick={() => { setMessage(null); setFormVersion((version) => version + 1); setOpen(true); }}>Edit</Button>
    </div>
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={`Edit ${service.name}`}
      error={message?.status === "error" ? message.text : undefined}
      footer={
        <ButtonGroup>
          <Button type="submit" form={formId} variant="primary" loading={busy} disabled={busy}>Save service</Button>
          <Button type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        </ButtonGroup>
      }
    >
      <form key={formVersion} id={formId} className={styles.editForm} onSubmit={save}>
        <div className={styles.fields}>
          <Input label="Category" name="category" maxLength={80} defaultValue={service.category} required />
          <Input label="Service name" name="name" maxLength={120} defaultValue={service.name} required />
          <Select label="Default job class" name="default_class" defaultValue={service.default_class}>
            <option value="minor">Minor</option><option value="major">Major</option>
          </Select>
          <Input label="Display order" name="sort_order" type="number" min="0" step="1" defaultValue={service.sort_order} required />
        </div>
        <div className={styles.flags}>
          <label className={styles.flag}><input type="checkbox" name="urgent_allowed" defaultChecked={service.urgent_allowed} /> Allow urgent requests</label>
          <label className={styles.flag}><input type="checkbox" name="active" defaultChecked={service.active} /> Active for new bookings</label>
        </div>
        {message?.status === "success" && <StatusMessage status="success">{message.text}</StatusMessage>}
      </form>
    </Modal>
  </>;
}
