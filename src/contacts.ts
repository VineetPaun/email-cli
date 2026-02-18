import fs from "node:fs";
import path from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";

export type Contact = {
  name: string;
  company: string;
  email: string;
};

const NAME_ALIASES = new Set([
  "name",
  "fullname",
  "full_name",
  "contactname",
  "contact_name",
  "recipient",
  "firstname",
  "first_name"
]);

const EMAIL_ALIASES = new Set([
  "email",
  "e-mail",
  "mail",
  "emailaddress",
  "email_address",
  "workemail",
  "work_email"
]);

const COMPANY_ALIASES = new Set([
  "company",
  "companyname",
  "company_name",
  "organization",
  "org"
]);

function normalizeHeader(header: string): string {
  return header.toLowerCase().replaceAll(" ", "").replaceAll("_", "").replaceAll("-", "").trim();
}

function detectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (EMAIL_ALIASES.has(normalized) && !("email" in mapping)) {
      mapping.email = header;
    } else if (NAME_ALIASES.has(normalized) && !("name" in mapping)) {
      mapping.name = header;
    } else if (COMPANY_ALIASES.has(normalized) && !("company" in mapping)) {
      mapping.company = header;
    }
  }

  if (!("email" in mapping)) {
    throw new Error(
      `Could not find email column. Expected one of: ${[...EMAIL_ALIASES].join(", ")}. Found headers: ${JSON.stringify(headers)}`
    );
  }

  return mapping;
}

function toRowsWithHeaders(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const records = csvParse(content, {
    relax_column_count: true,
    skip_empty_lines: false
  }) as string[][];

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = (records[0] ?? []).map((h) => String(h));
  const body = records.slice(1);
  const rows = body.map((cols) => {
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      row[headers[i]] = String(cols[i] ?? "");
    }
    return row;
  });

  return { headers, rows };
}

export function loadContactedEmails(contactsPath: string): Set<string> {
  const contactedPath = path.join(path.dirname(path.resolve(contactsPath)), "contacted.csv");
  if (!fs.existsSync(contactedPath)) {
    return new Set();
  }

  const emails = new Set<string>();
  try {
    const content = fs.readFileSync(contactedPath, "utf8");
    const rows = csvParse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
    for (const row of rows) {
      const email = String(row.email ?? "").trim();
      if (email) {
        emails.add(email);
      }
    }
  } catch {
    return new Set();
  }

  return emails;
}

export function loadContacts(filePath: string): Contact[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const content = fs.readFileSync(resolved, "utf8");
  const { headers, rows } = toRowsWithHeaders(content);

  if (headers.length === 0) {
    throw new Error("CSV has no headers");
  }

  const colMap = detectColumns(headers);
  const normalized: Contact[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const email = String(row[colMap.email] ?? "").trim();
    if (!email) {
      throw new Error(`Row ${i + 2}: missing email`);
    }

    normalized.push({
      name: String(row[colMap.name] ?? "").trim(),
      company: String(row[colMap.company] ?? "").trim(),
      email
    });
  }

  return normalized;
}

export function writeContacts(filePath: string, rows: Contact[], createParent = true): void {
  const resolved = path.resolve(filePath);
  if (createParent) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  const csv = csvStringify(rows, {
    header: true,
    columns: ["name", "company", "email"]
  });

  fs.writeFileSync(resolved, csv, "utf8");
}

export function appendContacted(filePath: string, rows: Contact[]): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const exists = fs.existsSync(resolved);
  const csv = csvStringify(rows, {
    header: !exists,
    columns: ["name", "company", "email"]
  });

  fs.appendFileSync(resolved, csv, "utf8");
}
