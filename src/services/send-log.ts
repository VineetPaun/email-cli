import fs from "node:fs";
import path from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import { SendLogRow } from "../types.js";

const LOG_COLUMNS: Array<keyof SendLogRow> = [
  "timestamp",
  "run_id",
  "campaign_key",
  "email",
  "name",
  "company",
  "template",
  "role",
  "subject",
  "status",
  "error"
];

export function createRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildCampaignKey(contactsPath: string, templatePath: string, subject: string): string {
  return [path.resolve(contactsPath), path.resolve(templatePath), subject.trim().toLowerCase()].join("::");
}

export function appendSendLog(logPath: string, row: SendLogRow): void {
  const resolved = path.resolve(logPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const exists = fs.existsSync(resolved);
  const csv = csvStringify([row], {
    header: !exists,
    columns: LOG_COLUMNS
  });

  fs.appendFileSync(resolved, csv, "utf8");
}

export function loadSentEmailsForCampaign(logPath: string, campaignKey: string): Set<string> {
  const resolved = path.resolve(logPath);
  if (!fs.existsSync(resolved)) {
    return new Set<string>();
  }

  try {
    const content = fs.readFileSync(resolved, "utf8");
    const rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true
    }) as Array<Record<string, string>>;

    const sent = new Set<string>();
    for (const row of rows) {
      const status = String(row.status ?? "").trim();
      const rowKey = String(row.campaign_key ?? "").trim();
      const email = String(row.email ?? "").trim();
      if (status === "sent" && rowKey === campaignKey && email) {
        sent.add(email);
      }
    }

    return sent;
  } catch {
    return new Set<string>();
  }
}
