import fs from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import { type Contact, writeContacts } from "../contacts.js";
import { defaultContactsPath, resolvePath } from "../config/project.js";

export function registerImportCommand(program: Command): void {
  program
    .command("import <json_file>")
    .option("-o, --output <path>", "Output CSV path (default: project contacts.csv).", defaultContactsPath())
    .description(
      "Convert JSON to contacts.csv. Supports YC founders format (company, founders[].name, companyEmails[]) or flat {name, company, email}."
    )
    .action((jsonFile, opts) => {
      const source = resolvePath(String(jsonFile));
      const output = resolvePath(String(opts.output ?? defaultContactsPath()));

      const dataRaw = fs.readFileSync(source, "utf8");
      const parsed = JSON.parse(dataRaw) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];

      const rows: Contact[] = [];

      for (const item of items) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const obj = item as Record<string, unknown>;

        let email = "";
        const emails = obj.companyEmails;
        if (Array.isArray(emails) && emails.length > 0) {
          email = String(emails[0] ?? "").trim();
        } else {
          email = String(obj.email ?? "").trim();
        }

        if (!email) {
          continue;
        }

        let name = String(obj.name ?? "").trim();
        if (!name) {
          const founders = obj.founders;
          if (Array.isArray(founders) && founders.length > 0) {
            const first = founders[0];
            if (first && typeof first === "object") {
              name = String((first as Record<string, unknown>).name ?? "").trim();
            }
          }
        }

        const company = String(obj.company ?? obj.company_name ?? obj.organization ?? "").trim();
        rows.push({ name, company, email });
      }

      if (rows.length === 0) {
        throw new Error("No records with email found in JSON.");
      }

      writeContacts(output, rows);
      console.log(chalk.green(`[ok] Wrote ${rows.length} contact(s) to ${output}`));
    });
}
