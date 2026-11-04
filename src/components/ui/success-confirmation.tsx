"use client";
import { useEffect } from "react";
import { notifySuccess } from "@/lib/ui-feedback";

export function SuccessConfirmation({ message }: { message: string }) {
  useEffect(() => {
    notifySuccess(message);
  }, [message]);
  return null;
}
