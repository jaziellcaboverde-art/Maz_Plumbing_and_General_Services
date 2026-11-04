"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Modal } from "./modal";

/** Keeps the list underneath; Back, Escape and Close return to its exact state. */
export function RouteModal({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const closing = useRef(false);
  // Next preserves this route's state across history navigation, but reactivates effects.
  useEffect(() => {
    closing.current = false;
  }, []);
  function close() {
    if (closing.current) return;
    closing.current = true;
    router.back();
  }
  return (
    <Modal open wide onClose={close} title={title}>
      {children}
    </Modal>
  );
}
