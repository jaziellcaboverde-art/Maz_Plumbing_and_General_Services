/** Receipt CSV is parsed again on the server; client totals are never trusted. */
export function parseReceiptCsv(source: string) {
  if (
    typeof source !== "string" ||
    new TextEncoder().encode(source).length > 65536
  )
    throw new Error("Use a CSV file no larger than 64 KB.");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const endField = () => {
    row.push(field.trim());
    field = "";
    closed = false;
  };
  const endRow = () => {
    endField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  const text = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else field += ch;
    } else if (ch === ",") endField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else if (closed) {
      if (!/\s/.test(ch))
        throw new Error("Unexpected text after a quoted field.");
    } else if (ch === '"') {
      if (field) throw new Error("Invalid CSV quotes.");
      quoted = true;
    } else field += ch;
  }
  if (quoted) throw new Error("Unclosed CSV quotes.");
  if (field || row.length || closed) endRow();
  const header = rows.shift()?.map((cell) => cell.toLowerCase());
  if (header?.join(",") !== "description,amount")
    throw new Error("Use the sample headers: description,amount.");
  if (rows.length < 2 || rows.length > 31)
    throw new Error("Include 1-30 expenses and one final TOTAL row.");
  const cents = (value: string) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))
      throw new Error(
        "Amounts must be positive PHP numbers with up to two decimal places.",
      );
    const amount = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000)
      throw new Error(
        "Each amount must be between PHP 0.01 and PHP 10,000,000.",
      );
    return amount;
  };
  const last = rows.pop()!;
  if (last.length !== 2 || last[0].toUpperCase() !== "TOTAL")
    throw new Error("The last row must contain TOTAL and the receipt total.");
  const declared = cents(last[1]);
  let sum = 0;
  const items = rows.map((cells) => {
    if (
      cells.length !== 2 ||
      cells[0].length < 3 ||
      cells[0].length > 300 ||
      cells[0].toUpperCase() === "TOTAL"
    )
      throw new Error(
        "Each expense needs a description (3-300 characters) and an amount. Only one TOTAL row is allowed.",
      );
    const amount = cents(cells[1]);
    sum += amount;
    return { description: cells[0], quantity: 1, unitPrice: amount / 100 };
  });
  if (sum !== declared)
    throw new Error("The TOTAL must equal the sum of all expenses.");
  if (sum > 1000000000)
    throw new Error("The quotation total cannot exceed PHP 10,000,000.");
  return { items, total: sum / 100 };
}
