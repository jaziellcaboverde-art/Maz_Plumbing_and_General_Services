"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "@/lib/cx";
import type { Status } from "./status-message";
import styles from "./toast.module.css";
import { DEFAULT_SUCCESS_MESSAGE, SUCCESS_EVENT } from "@/lib/ui-feedback";

type ToastInput = {
  status: Status;
  /** Reuse the button's name: "Send request" gives "Request sent". */
  message: string;
  /** Milliseconds. Success and note toasts close after 5 seconds. Warnings and errors stay until dismissed. */
  durationMs?: number | null;
};

type ToastItem = ToastInput & { id: number };

type ToastApi = {
  show: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
  toasts: ToastItem[];
};

const ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
  info: Info,
} as const;
const WORDS: Record<Status, string> = {
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Note",
};
const DEFAULT_DURATION_MS = 5000;
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) =>
      [
        ...(toast.status === "success" &&
        current.at(-1)?.message === DEFAULT_SUCCESS_MESSAGE
          ? current.slice(0, -1)
          : current),
        { ...toast, id },
      ].slice(-MAX_VISIBLE),
    );
    return id;
  }, []);

  useEffect(() => {
    const onSuccess = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message === "string") show({ status: "success", message });
    };
    window.addEventListener(SUCCESS_EVENT, onSuccess);
    return () => window.removeEventListener(SUCCESS_EVENT, onSuccess);
  }, [show]);
  const api = useMemo(
    () => ({ show, dismiss, toasts }),
    [show, dismiss, toasts],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

/** A dialog gets its own viewport so confirmations stay above the native backdrop. */
export function ToastViewport({ modal = false }: { modal?: boolean }) {
  const api = useContext(ToastContext);
  if (!api || !api.toasts.length) return null;
  return (
    <div
      className={styles.region}
      data-scope={modal ? "modal" : "page"}
      aria-label="Action confirmations"
    >
      {api.toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={api.dismiss} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const Icon = ICONS[toast.status];
  const durationMs =
    toast.durationMs !== undefined
      ? toast.durationMs
      : toast.status === "success" || toast.status === "info"
        ? DEFAULT_DURATION_MS
        : null;

  useEffect(() => {
    if (durationMs === null) return;
    const timer = setTimeout(() => onDismiss(toast.id), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss, toast.id]);

  return (
    <div
      className={cx(styles.toast, styles[toast.status])}
      role={toast.status === "error" ? "alert" : "status"}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <p className={styles.text}>
        <span className="sr-only">{WORDS[toast.status]}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
      >
        <X className={styles.dismissIcon} aria-hidden="true" />
      </button>
    </div>
  );
}
