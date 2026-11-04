"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { StatusMessage } from "./status-message";
import styles from "./modal.module.css";

type Subview = { id: string; title: string; close: () => void };
type ModalScope = {
  host: HTMLDivElement | null;
  activeId: string | null;
  register: (view: Subview) => void;
  unregister: (id: string) => void;
};
const ModalContext = createContext<ModalScope | null>(null);
const subscribeToDocument = () => () => {};
const getDocumentHost = () => document.body;
const getServerHost = () => null;
export function useInsideModal() {
  return useContext(ModalContext) !== null;
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
  error?: string;
  wide?: boolean;
};

/** A secondary module becomes a tab in the existing dialog, never another overlay. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  error,
  wide = false,
}: ModalProps) {
  const parent = useContext(ModalContext);
  const ref = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const closeRequested = useRef(false);
  const requestClose = useCallback(() => {
    if (closeRequested.current) return;
    closeRequested.current = true;
    // Release the native backdrop before waiting for state or route navigation.
    if (ref.current?.open) ref.current.close();
    closeRef.current();
  }, []);
  const titleId = useId();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const portalHost = useSyncExternalStore<HTMLElement | null>(
    subscribeToDocument,
    getDocumentHost,
    getServerHost,
  );
  const [views, setViews] = useState<Subview[]>([]);
  const subview = views.at(-1);
  const closeSubview = useCallback(() => closeRef.current(), []);
  const register = useCallback(
    (view: Subview) =>
      setViews((current) =>
        current.some((item) => item.id === view.id)
          ? current.map((item) => (item.id === view.id ? view : item))
          : [...current, view],
      ),
    [],
  );
  const unregister = useCallback(
    (id: string) =>
      setViews((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const scope = useMemo(
    () => ({ host, activeId: subview?.id ?? null, register, unregister }),
    [host, subview?.id, register, unregister],
  );
  const parentRegister = parent?.register;
  const parentUnregister = parent?.unregister;
  const parentHost = parent?.host;
  const parentActiveId = parent?.activeId;

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!parentRegister || !parentUnregister || !open) return;
    parentRegister({ id: titleId, title, close: closeSubview });
    return () => parentUnregister(titleId);
  }, [parentRegister, parentUnregister, open, titleId, title, closeSubview]);
  useEffect(() => {
    if (!parentHost || !open || parentActiveId !== titleId) return;
    const previous = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [parentHost, parentActiveId, open, titleId]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || parent) return;
    if (open && !dialog.open) {
      closeRequested.current = false;
      dialog.showModal();
      dialog
        .querySelector<HTMLButtonElement>('button[aria-label="Close"]')
        ?.focus({ preventScroll: true });
      dialog.scrollTop = 0;
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      // Hidden/preserved routes must never leave a modal in the browser's top layer.
      closeRequested.current = true;
      if (dialog.open) dialog.close();
    };
  }, [open, parent, portalHost]);
  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
  }, [subview?.id]);

  const body = (
    <>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {children && <div className={styles.body}>{children}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );

  if (parent)
    return open && parent.host
      ? createPortal(
          <div
            ref={panelRef}
            hidden={parent.activeId !== titleId}
            tabIndex={-1}
            role="tabpanel"
            id={titleId + "-panel"}
            aria-labelledby={titleId + "-tab"}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
              }
            }}
          >
            {body}
          </div>,
          parent.host,
        )
      : null;

  return portalHost
    ? createPortal(
        <dialog
          ref={ref}
          className={styles.dialog}
          data-wide={wide || undefined}
          aria-labelledby={titleId}
          onClose={(event) => {
            event.stopPropagation();
            // Ignore events from controlled closing or a previously hidden route.
            if (open && !event.currentTarget.open) requestClose();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) requestClose();
          }}
        >
          <ModalContext value={scope}>
            <div className={styles.panel}>
              <div className={styles.header}>
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
                <button
                  type="button"
                  className={styles.close}
                  onClick={requestClose}
                  aria-label="Close"
                >
                  <X className={styles.closeIcon} aria-hidden="true" />
                </button>
              </div>
              {subview && (
                <div
                  role="tablist"
                  aria-label="Module views"
                  className={styles.viewTabs}
                >
                  <button
                    type="button"
                    role="tab"
                    id={titleId + "-overview-tab"}
                    aria-controls={titleId + "-overview"}
                    aria-selected={false}
                    className={styles.viewTab}
                    onClick={() =>
                      views.toReversed().forEach((view) => view.close())
                    }
                    onKeyDown={(event) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      ) {
                        event.preventDefault();
                        document.getElementById(subview.id + "-tab")?.focus();
                      }
                    }}
                  >
                    Overview
                  </button>
                  {views.map((view, index) => (
                    <button
                      key={view.id}
                      type="button"
                      role="tab"
                      id={view.id + "-tab"}
                      aria-controls={view.id + "-panel"}
                      aria-selected={view.id === subview.id}
                      className={styles.viewTab}
                      onClick={() =>
                        views
                          .slice(index + 1)
                          .reverse()
                          .forEach((item) => item.close())
                      }
                      onKeyDown={(event) => {
                        if (
                          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                            event.key,
                          )
                        ) {
                          event.preventDefault();
                          view.close();
                        }
                      }}
                    >
                      {view.title}
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.viewport} ref={viewportRef}>
                <div id={titleId + "-overview"} hidden={!!subview}>
                  {body}
                </div>
                <div ref={setHost} hidden={!subview} />
              </div>
            </div>
          </ModalContext>
        </dialog>,
        portalHost,
      )
    : null;
}
