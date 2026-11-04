/** Round half-cent deposits up, matching PostgreSQL round(numeric, 2). */
export function quotationDeposit(subtotal: number, contractRequired: boolean) {
  return contractRequired
    ? Math.round(Math.round(subtotal * 100) / 2) / 100
    : 0;
}
