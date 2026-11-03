/** datetime-local values in this workspace always represent Philippine time. */
export function manilaInputToISO(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  return normalized === value ? date.toISOString() : null;
}
