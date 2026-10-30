"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonGroup } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusMessage } from "@/components/ui/status-message";
import styles from "./page.module.css";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  providerStatus: string | null;
};

export function UsersTable({ users }: { users: AdminUserRow[] }) {
  return <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead><tr><th scope="col">User</th><th scope="col">Contact</th><th scope="col">Role</th><th scope="col">Provider status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>
        {users.map((user) => <UserRow key={user.id} user={user} />)}
        {!users.length && <tr><td colSpan={5}>No users found.</td></tr>}
      </tbody>
    </table>
  </div>;
}

function UserRow({ user }: { user: AdminUserRow }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canRemoveProvider = user.role === "provider" && user.providerStatus !== null;

  async function removeProviderDetails() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/provider-details`, { method: "DELETE" });
      const result = await response.json().catch(() => null) as { error?: string; sessionRefreshRequired?: boolean } | null;
      if (!response.ok) throw new Error(result?.error || "Could not remove provider details.");
      setConfirmOpen(false);
      setSuccess(`${user.name}'s provider details were removed. Their login account and service history were kept as a customer account.${result?.sessionRefreshRequired ? " Their next sign-in will refresh the account role." : ""}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove provider details.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <tr>
      <th scope="row"><strong>{user.name}</strong><small>{user.email}</small></th>
      <td>{user.mobile}</td>
      <td><span className={styles.role}>{user.role}</span></td>
      <td>{user.providerStatus ?? "—"}</td>
      <td className={styles.actionCell}>
        {canRemoveProvider && <Button type="button" variant="secondary" onClick={() => { setError(null); setConfirmOpen(true); }}>Remove provider details</Button>}
        <Modal
          open={confirmOpen}
          onClose={() => { if (!busy) setConfirmOpen(false); }}
          title="Remove provider details?"
          error={error ?? undefined}
          footer={<ButtonGroup>
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={removeProviderDetails}>Remove provider details</Button>
            <Button type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</Button>
          </ButtonGroup>}
        >
          <p>This removes {user.name}&apos;s provider profile, service links, and private verification files. Their login, name, contact details, and booking and payment history stay in the system; the account becomes a customer account.</p>
          <p>Removal is blocked until any unfinished bookings are completed or reassigned.</p>
        </Modal>
      </td>
    </tr>
    {success && <tr><td colSpan={5}><div className={styles.notice}><StatusMessage status="success">{success}</StatusMessage><button type="button" onClick={() => setSuccess(null)} aria-label="Dismiss message">Dismiss</button></div></td></tr>}
  </>;
}
