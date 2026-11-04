import { z } from "zod";

export const MAX_IMPORT_ROWS = 100;
export const PROVIDERS_PER_REQUEST = 10;
export const MAX_CSV_BYTES = 256 * 1024;
export type ImportService = { id: string; name: string; category: string };
export type ProviderDraft = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  dailyRate: string;
  serviceArea: string;
  services: string[];
};
export type ProviderImportResult = {
  key: string;
  email: string;
  status: "created" | "failed" | "uncertain";
  providerId?: string;
  error?: string;
};

function mobileNumber(value: unknown) {
  if (typeof value !== "string") return value;
  const mobile = value.replace(/[\s()-]/g, "");
  if (/^09\d{9}$/.test(mobile)) return "+63" + mobile.slice(1);
  if (/^639\d{9}$/.test(mobile)) return "+" + mobile;
  if (/^9\d{9}$/.test(mobile)) return "+63" + mobile;
  return mobile;
}
const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(100)
  .refine((value) => !/[\r\n]/.test(value), "Use a single line");
const schema = z.object({
  key: z.string().min(1).max(100),
  firstName: name,
  lastName: name,
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  mobile: z.preprocess(
    mobileNumber,
    z.string().regex(/^\+639\d{9}$/, "Use a valid Philippine mobile number"),
  ),
  password: z
    .string()
    .max(72)
    .refine((value) => !value || value.length >= 8, "Use at least 8 characters")
    .default(""),
  dailyRate: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === null
        ? null
        : typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value.trim())
          ? Number(value)
          : value,
    z.number().finite().min(0).max(9999999999.99).multipleOf(0.01).nullable(),
  ),
  serviceArea: z.string().trim().max(300).default(""),
  services: z
    .array(z.string().trim().min(1).max(200))
    .min(1, "Choose at least one service")
    .max(50),
});
export type PreparedProvider = Omit<z.infer<typeof schema>, "services"> & {
  serviceIds: string[];
};
export type ProviderValidation = {
  key: string;
  email: string;
  value?: PreparedProvider;
  errors: string[];
};
const normalized = (value: string) => value.trim().toLocaleLowerCase("en");

/** Shared preview/server validation. Only actual active catalog IDs may be approved. */
export function validateProviders(
  rows: unknown[],
  services: readonly ImportService[],
): ProviderValidation[] {
  const emails = rows.map((row) =>
    row &&
    typeof row === "object" &&
    "email" in row &&
    typeof row.email === "string"
      ? normalized(row.email)
      : "",
  );
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    const fallback = {
      key:
        row &&
        typeof row === "object" &&
        "key" in row &&
        typeof row.key === "string"
          ? row.key
          : String(index + 1),
      email: emails[index],
    };
    if (!parsed.success)
      return {
        ...fallback,
        errors: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    const { services: requested, ...values } = parsed.data;
    const errors: string[] = [];
    const ids: string[] = [];
    if (emails.filter((email) => email === values.email).length > 1)
      errors.push("Email appears more than once in this batch.");
    for (const token of requested) {
      const byId = services.find((service) => service.id === token);
      const matches = byId
        ? [byId]
        : services.filter(
            (service) =>
              normalized(service.name) === normalized(token) ||
              normalized(`${service.category}::${service.name}`) ===
                normalized(token),
          );
      if (matches.length !== 1)
        errors.push(
          `Service "${token}" is unavailable or ambiguous. Use an active service ID or Category::Service name.`,
        );
      else ids.push(matches[0].id);
    }
    return {
      key: values.key,
      email: values.email,
      errors,
      ...(errors.length
        ? {}
        : { value: { ...values, serviceIds: [...new Set(ids)] } }),
    };
  });
}

/** Quoted fields, escaped quotes, CRLF, UTF-8 BOM and quoted line breaks. */
export function parseProviderCsv(text: string): ProviderDraft[] {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES)
    throw new Error("CSV must be 256 KB or smaller.");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let endedQuote = false;
  text = text.replace(/^\uFEFF/, "");
  const finishField = () => {
    row.push(field);
    field = "";
    endedQuote = false;
  };
  const finishRow = () => {
    finishField();
    if (row.some((cell) => cell.trim())) records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        endedQuote = true;
      } else field += char;
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (endedQuote) {
      if (!/\s/.test(char))
        throw new Error("Unexpected text after a quoted CSV field.");
    } else if (char === '"') {
      if (field)
        throw new Error("Quotes must start at the beginning of a CSV field.");
      quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (field || row.length || endedQuote) finishRow();
  const headers = records.shift()?.map((value) => value.trim().toLowerCase());
  if (!headers) throw new Error("CSV is empty.");
  const fields = {
    first_name: "firstName",
    last_name: "lastName",
    email: "email",
    mobile: "mobile",
    password: "password",
    daily_rate: "dailyRate",
    service_area: "serviceArea",
    services: "services",
  } as const;
  for (const required of [
    "first_name",
    "last_name",
    "email",
    "mobile",
    "services",
  ])
    if (!headers.includes(required))
      throw new Error(
        `Missing CSV column: ${required}. Download the template for the correct headings.`,
      );
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV column headings must be unique.");
  if (headers.some((header) => !Object.hasOwn(fields, header)))
    throw new Error(
      "Unknown CSV column. Use the downloaded template headings.",
    );
  if (!records.length || records.length > MAX_IMPORT_ROWS)
    throw new Error(
      `Include between 1 and ${MAX_IMPORT_ROWS} providers per CSV.`,
    );
  return records.map((cells, index) => {
    if (cells.length !== headers.length)
      throw new Error(
        `CSV row ${index + 2} has the wrong number of columns. Quote values containing commas.`,
      );
    const values = {
      key: `csv-${index + 2}`,
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      dailyRate: "",
      serviceArea: "",
      services: [],
    } as ProviderDraft;
    headers.forEach((header, i) => {
      const fieldName = fields[header as keyof typeof fields];
      if (fieldName === "services")
        values.services = cells[i]
          .split("|")
          .map((value) => value.trim())
          .filter(Boolean);
      else
        values[fieldName] =
          fieldName === "password" ? cells[i] : cells[i].trim();
    });
    return values;
  });
}

export function providerCsvTemplate(services: readonly ImportService[]) {
  const service = services[0];
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
  return (
    "\uFEFFfirst_name,last_name,email,mobile,services,daily_rate,service_area,password\r\n" +
    [
      "Juan",
      "Dela Cruz",
      "juan@example.com",
      "09171234567",
      service
        ? `${service.category}::${service.name}`
        : "Category::Service name",
      "800",
      "Pasig",
      "",
    ]
      .map(quote)
      .join(",") +
    "\r\n"
  );
}
