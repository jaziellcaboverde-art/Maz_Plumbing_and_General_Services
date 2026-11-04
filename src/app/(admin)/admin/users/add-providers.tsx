"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusMessage } from "@/components/ui/status-message";
import { notifySuccess } from "@/lib/ui-feedback";
import {
  MAX_CSV_BYTES,
  MAX_IMPORT_ROWS,
  PROVIDERS_PER_REQUEST,
  parseProviderCsv,
  providerCsvTemplate,
  validateProviders,
  type ImportService,
  type ProviderDraft,
  type ProviderImportResult,
} from "@/lib/provider/admin-import";
import styles from "./add-providers.module.css";

const emptyRow = (key: string): ProviderDraft => ({
  key,
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  password: "",
  dailyRate: "",
  serviceArea: "",
  services: [],
});
function download(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AddProviders({ services }: { services: ImportService[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [manual, setManual] = useState<ProviderDraft[]>([emptyRow("manual-1")]);
  const [csv, setCsv] = useState<ProviderDraft[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [results, setResults] = useState<ProviderImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const counter = useRef(2);
  const running = useRef(false);
  const rows = tab === "manual" ? manual : csv;
  const setRows = tab === "manual" ? setManual : setCsv;
  const validation = useMemo(
    () => validateProviders(rows, services),
    [rows, services],
  );
  const ready = validation.filter((row) => row.value);
  const locked = busy || results.length > 0;
  const created = results.filter((row) => row.status === "created");
  const unsubmitted = validation.filter(
    (row) => !row.value && !results.some((result) => result.key === row.key),
  ).length;

  function update(key: string, patch: Partial<ProviderDraft>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
    setReviewed(false);
    setError("");
  }
  async function loadCsv(file?: File) {
    if (!file) return;
    setError("");
    setReviewed(false);
    try {
      if (file.size > MAX_CSV_BYTES)
        throw new Error("CSV must be 256 KB or smaller.");
      setCsv(parseProviderCsv(await file.text()));
      setReviewed(true);
    } catch (caught) {
      setCsv([]);
      setError(
        caught instanceof Error ? caught.message : "Could not read the CSV.",
      );
    }
  }
  async function add() {
    if (running.current || !reviewed || !ready.length) return;
    running.current = true;
    setBusy(true);
    setError("");
    setProgress(0);
    // Generate once before requests; retain these credentials even if a response is interrupted.
    const working = rows.map((row) => ({
      ...row,
      password:
        row.password || `Maz-${crypto.randomUUID().replaceAll("-", "")}!`,
    }));
    setRows(working);
    const prepared = validateProviders(working, services)
      .filter((row) => row.value)
      .map((row) => working.find((item) => item.key === row.key)!);
    const accumulated: ProviderImportResult[] = [];
    try {
      for (
        let index = 0;
        index < prepared.length;
        index += PROVIDERS_PER_REQUEST
      ) {
        const chunk = prepared.slice(index, index + PROVIDERS_PER_REQUEST);
        try {
          const response = await fetch("/api/admin/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(120000),
            body: JSON.stringify({ source: tab, providers: chunk }),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            accumulated.push(
              ...chunk.map((row) => ({
                key: row.key,
                email: row.email,
                status: "failed" as const,
                error: payload?.error ?? "This batch could not be added.",
              })),
            );
          } else if (
            Array.isArray(payload?.results) &&
            payload.results.length === chunk.length &&
            chunk.every((row) =>
              payload.results.some(
                (result: ProviderImportResult) =>
                  result.key === row.key &&
                  ["created", "failed", "uncertain"].includes(result.status),
              ),
            )
          )
            accumulated.push(...payload.results);
          else throw new Error("Response was incomplete");
        } catch {
          accumulated.push(
            ...chunk.map((row) => ({
              key: row.key,
              email: row.email,
              status: "uncertain" as const,
              error:
                "Response was interrupted. Check the directory before retrying this email.",
            })),
          );
          accumulated.push(
            ...prepared.slice(index + PROVIDERS_PER_REQUEST).map((row) => ({
              key: row.key,
              email: row.email,
              status: "failed" as const,
              error: "Not sent because the connection was interrupted.",
            })),
          );
          setResults([...accumulated]);
          break;
        }
        setProgress(Math.min(index + chunk.length, prepared.length));
        setResults([...accumulated]);
      }
      const count = accumulated.filter(
        (row) => row.status === "created",
      ).length;
      if (count) {
        notifySuccess(
          `${count} provider${count === 1 ? "" : "s"} added and approved.`,
        );
        router.refresh();
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function credentials() {
    const text = created
      .map((result) => {
        const row = rows.find((item) => item.key === result.key)!;
        return `${row.firstName} ${row.lastName}\nEmail: ${result.email}\nPassword: ${row.password}\nStatus: Approved provider\n`;
      })
      .join("\n");
    download(
      "MAZ provider sign-in details\nShare each account's details only with its provider. Providers can change their password in Settings.\n\n" +
        text,
      "maz-provider-sign-in-details.txt",
      "text/plain;charset=utf-8",
    );
  }
  function startAgain(failedOnly = false) {
    if (failedOnly) {
      const keys = new Set([
        ...results
          .filter((row) => row.status === "failed")
          .map((row) => row.key),
        ...validation.filter((row) => !row.value).map((row) => row.key),
      ]);
      setRows(rows.filter((row) => keys.has(row.key)));
    } else if (tab === "manual")
      setManual([emptyRow(`manual-${counter.current++}`)]);
    else setCsv([]);
    setResults([]);
    setReviewed(false);
    setError("");
    setProgress(0);
  }
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden="true" />
        Add providers
      </Button>
      {open && (
        <Modal
          open
          wide
          title="Add existing providers"
          onClose={() => setOpen(false)}
        >
          <div className={styles.page}>
            <p>
              Existing MAZ workers are approved immediately. No application is
              required.
            </p>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Add provider method"
            >
              {(["manual", "csv"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  role="tab"
                  id={`provider-${method}-tab`}
                  aria-controls={`provider-${method}-panel`}
                  aria-selected={tab === method}
                  tabIndex={tab === method ? 0 : -1}
                  disabled={locked}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? "manual"
                        : event.key === "End"
                          ? "csv"
                          : method === "manual"
                            ? "csv"
                            : "manual";
                    setTab(next);
                    setReviewed(next === "csv" && csv.length > 0);
                    setError("");
                    document.getElementById(`provider-${next}-tab`)?.focus();
                  }}
                  onClick={() => {
                    setTab(method);
                    setReviewed(method === "csv" && csv.length > 0);
                    setError("");
                  }}
                >
                  {method === "manual" ? (
                    <UserPlus aria-hidden="true" />
                  ) : (
                    <FileSpreadsheet aria-hidden="true" />
                  )}
                  {method === "manual" ? "Manual" : "CSV import"}
                </button>
              ))}
            </div>
            {error && <StatusMessage status="error">{error}</StatusMessage>}
            {!services.length && (
              <StatusMessage status="warning">
                Add active services to the catalog before adding providers.
              </StatusMessage>
            )}
            <div
              role="tabpanel"
              id={`provider-${tab}-panel`}
              aria-labelledby={`provider-${tab}-tab`}
            >
              {tab === "manual" ? (
                <div className={styles.page}>
                  <p className={styles.hint}>
                    Leave Password blank to generate one. Add one worker or
                    several at once.
                  </p>
                  {manual.map((row, index) => (
                    <fieldset
                      disabled={locked}
                      className={styles.worker}
                      key={row.key}
                    >
                      <legend>Provider {index + 1}</legend>
                      <div className={styles.fields}>
                        <Input
                          label="First name"
                          value={row.firstName}
                          maxLength={100}
                          onChange={(event) =>
                            update(row.key, { firstName: event.target.value })
                          }
                          placeholder="Juan"
                        />
                        <Input
                          label="Last name"
                          value={row.lastName}
                          maxLength={100}
                          onChange={(event) =>
                            update(row.key, { lastName: event.target.value })
                          }
                          placeholder="Dela Cruz"
                        />
                        <Input
                          label="Email"
                          type="email"
                          value={row.email}
                          maxLength={254}
                          onChange={(event) =>
                            update(row.key, { email: event.target.value })
                          }
                          placeholder="juan@example.com"
                        />
                        <Input
                          label="Mobile"
                          type="tel"
                          value={row.mobile}
                          maxLength={24}
                          onChange={(event) =>
                            update(row.key, { mobile: event.target.value })
                          }
                          placeholder="09171234567"
                        />
                        <Input
                          label="Daily rate (optional)"
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.dailyRate}
                          onChange={(event) =>
                            update(row.key, { dailyRate: event.target.value })
                          }
                          placeholder="800"
                        />
                        <Input
                          label="Service area (optional)"
                          value={row.serviceArea}
                          maxLength={300}
                          onChange={(event) =>
                            update(row.key, { serviceArea: event.target.value })
                          }
                          placeholder="Pasig, Marikina"
                        />
                        <Input
                          label="Password (optional)"
                          type="password"
                          autoComplete="new-password"
                          value={row.password}
                          maxLength={72}
                          onChange={(event) =>
                            update(row.key, { password: event.target.value })
                          }
                          placeholder="Generated if left blank"
                        />
                      </div>
                      <details className={styles.services}>
                        <summary>
                          Approved services ({row.services.length} selected)
                        </summary>
                        <div className={styles.choices}>
                          {services.map((service) => (
                            <label key={service.id}>
                              <input
                                type="checkbox"
                                checked={row.services.includes(service.id)}
                                onChange={(event) =>
                                  update(row.key, {
                                    services: event.target.checked
                                      ? [...row.services, service.id]
                                      : row.services.filter(
                                          (id) => id !== service.id,
                                        ),
                                  })
                                }
                              />
                              <span>
                                {service.name}
                                <small>{service.category}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                      {manual.length > 1 && (
                        <Button
                          onClick={() => {
                            setManual((current) =>
                              current.filter((item) => item.key !== row.key),
                            );
                            setReviewed(false);
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                          Remove provider {index + 1}
                        </Button>
                      )}
                    </fieldset>
                  ))}
                  {!locked && manual.length < MAX_IMPORT_ROWS && (
                    <Button
                      onClick={() => {
                        setManual((current) => [
                          ...current,
                          emptyRow(`manual-${counter.current++}`),
                        ]);
                        setReviewed(false);
                      }}
                    >
                      Add another provider
                    </Button>
                  )}
                </div>
              ) : (
                <div className={styles.page}>
                  <div className={styles.actions}>
                    <Button
                      disabled={locked}
                      onClick={() =>
                        download(
                          providerCsvTemplate(services),
                          "maz-providers-template.csv",
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      <Download aria-hidden="true" />
                      Download CSV template
                    </Button>
                    <label className={styles.upload}>
                      Choose CSV
                      <input
                        aria-label="Provider CSV file"
                        type="file"
                        accept=".csv,text/csv"
                        disabled={locked}
                        onChange={(event) => {
                          void loadCsv(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className={styles.hint}>
                    Up to {MAX_IMPORT_ROWS} providers, 256 KB. Separate services
                    with |. Use a service ID, exact name, or Category::Service
                    name. Blank passwords are generated automatically.
                  </p>
                  <details className={styles.services}>
                    <summary>View service names for CSV</summary>
                    <ul>
                      {services.map((service) => (
                        <li key={service.id}>
                          {service.category}::{service.name}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
            </div>
            {reviewed && !results.length && (
              <>
                <p>
                  <strong>{ready.length} ready</strong>
                  {validation.length !== ready.length
                    ? ` · ${validation.length - ready.length} need corrections`
                    : ""}
                  . Review before creating accounts.
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <caption className="sr-only">
                      Provider import preview
                    </caption>
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Email</th>
                        <th>Services</th>
                        <th>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.map((row, index) => (
                        <tr key={row.key}>
                          <td>
                            {rows[index].firstName} {rows[index].lastName}
                          </td>
                          <td>{row.email || "Missing email"}</td>
                          <td>
                            {row.value?.serviceIds.length ??
                              rows[index].services.length}
                          </td>
                          <td>
                            {row.errors.length ? (
                              <span className={styles.problem}>
                                {row.errors.join(" ")}
                              </span>
                            ) : (
                              "Ready"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {results.length > 0 && (
              <section
                className={styles.page}
                aria-label="Provider import results"
              >
                <p role="status">
                  <strong>{created.length} added</strong> ·{" "}
                  {results.filter((row) => row.status !== "created").length +
                    unsubmitted}{" "}
                  not added or need checking
                  {busy ? ` · ${progress}/${ready.length} processed` : ""}
                </p>
                {created.length > 0 && (
                  <>
                    <p className={styles.hint}>
                      Save the sign-in details before starting another batch.
                      Providers can set working hours and payout details after
                      signing in.
                    </p>
                    <Button onClick={credentials}>
                      <Download aria-hidden="true" />
                      Download sign-in details
                    </Button>
                  </>
                )}
                <ul className={styles.results}>
                  {results.map((row) => (
                    <li key={row.key}>
                      <strong>{row.email}</strong>
                      <span data-status={row.status}>
                        {row.status === "created"
                          ? "Approved"
                          : row.status === "uncertain"
                            ? "Check account"
                            : "Not added"}
                      </span>
                      {row.error && <p>{row.error}</p>}
                    </li>
                  ))}
                </ul>
                {!busy && (
                  <div className={styles.actions}>
                    {(results.some((row) => row.status === "failed") ||
                      validation.some((row) => !row.value)) && (
                      <Button onClick={() => startAgain(true)}>
                        Review remaining rows
                      </Button>
                    )}
                    <Button onClick={() => startAgain()}>
                      Start another batch
                    </Button>
                  </div>
                )}
              </section>
            )}
            {!results.length && (
              <div className={styles.actions}>
                {!reviewed && rows.length > 0 && (
                  <Button
                    variant="primary"
                    disabled={!services.length || busy}
                    onClick={() => setReviewed(true)}
                  >
                    Review providers
                  </Button>
                )}
                {reviewed && (
                  <Button
                    variant="primary"
                    loading={busy}
                    disabled={!ready.length || busy}
                    onClick={() => void add()}
                  >
                    Add {ready.length} approved provider
                    {ready.length === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            )}
            {busy && (
              <p role="status">
                Adding providers… {progress}/{ready.length} processed.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
