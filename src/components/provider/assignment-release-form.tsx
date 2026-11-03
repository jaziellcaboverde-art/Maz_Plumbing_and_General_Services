"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import styles from "./workspace.module.css";
export function AssignmentReleaseForm({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <details>
      <summary>
        {admin
          ? "Release / replace assignment"
          : "Cannot work this assignment?"}
      </summary>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          const error = await postJson(
            admin
              ? `/api/admin/assignments/${id}/release`
              : `/api/provider/assignments/${id}/withdraw`,
            { reason },
          );
          setError(error);
          setBusy(false);
          if (!error) router.refresh();
        }}
      >
        <Textarea
          label={
            admin
              ? "Replacement or rescheduling plan"
              : "Reason for replacement / rescheduling"
          }
          value={reason}
          minLength={10}
          maxLength={1000}
          required
          onChange={(e) => setReason(e.target.value)}
        />
        {!admin && (
          <p>
            MAZ will arrange a replacement or rescheduling. Your assignment
            stays reserved until MAZ reviews the request.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <Button
          type="submit"
          disabled={busy || reason.trim().length < 10}
          loading={busy}
        >
          {admin ? "Release this worker only" : "Ask MAZ for replacement"}
        </Button>
      </form>
    </details>
  );
}
