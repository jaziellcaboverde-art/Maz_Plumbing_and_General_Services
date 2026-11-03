/** A crew member may finish before the parent renovation and its lead are done. */
export function ownWorkCompleted(
  providerId: string,
  leadId: string | null,
  states: string[],
): boolean {
  return (
    providerId !== leadId &&
    states.length > 0 &&
    states.every((state) => state === "completed")
  );
}
