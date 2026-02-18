import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadContacts } from "../contacts.js";
import { defaultContactsPath, normalizeRole, resolvePath, resolveTemplatePath, PROJECT_ROOT } from "../config/project.js";
import { getSmtpConfig, isAuthError, smtpTransport } from "../services/smtp.js";
import { templateEnv } from "../services/template.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .option("--template <path>", "Path to email template.")
    .option("--role <role>", "Template role to validate when --template is not set.")
    .option("--contacts <path>", "Path to CSV contacts file.")
    .option("--links", "Validate links.json.")
    .option("--smtp", "Validate SMTP config (connect only, no send).")
    .action(async (opts) => {
      const errors: string[] = [];
      const ok: string[] = [];

      let template = opts.template ? resolvePath(String(opts.template)) : null;
      let contacts = opts.contacts ? resolvePath(String(opts.contacts)) : null;
      let validateLinks = Boolean(opts.links);
      let validateSmtp = Boolean(opts.smtp);

      if (!template && !contacts && !validateLinks && !validateSmtp) {
        template = resolveTemplatePath(normalizeRole(opts.role ? String(opts.role) : undefined));
        contacts = defaultContactsPath();
        validateLinks = true;
        validateSmtp = true;
      }

      if (template) {
        if (!fs.existsSync(template)) {
          errors.push(`Template not found: ${template}`);
        } else {
          try {
            const env = templateEnv(path.dirname(template));
            const tpl = env.getTemplate(path.basename(template), true);
            tpl.render({
              name: "Test",
              company: "Test Co",
              email: "test@example.com",
              x: "",
              linkedin: "",
              github: "",
              portfolio: "",
              resume: "",
              sender_name: "Test"
            });
            ok.push(`Template OK: ${template}`);
          } catch (err) {
            errors.push(`Template error: ${(err as Error).message}`);
          }
        }
      }

      if (contacts) {
        if (!fs.existsSync(contacts)) {
          errors.push(`Contacts file not found: ${contacts}`);
        } else {
          try {
            const rows = loadContacts(contacts);
            ok.push(`Contacts OK: ${rows.length} row(s) in ${contacts}`);
          } catch (err) {
            errors.push(`Contacts error: ${(err as Error).message}`);
          }
        }
      }

      if (validateLinks) {
        const linksPath = path.join(PROJECT_ROOT, "links.json");
        if (!fs.existsSync(linksPath)) {
          console.log(chalk.gray(`links.json not found at ${linksPath} (optional)`));
        } else {
          try {
            JSON.parse(fs.readFileSync(linksPath, "utf8"));
            ok.push(`links.json OK: ${linksPath}`);
          } catch (err) {
            errors.push(`links.json invalid: ${(err as Error).message}`);
          }
        }
      }

      if (validateSmtp) {
        try {
          const cfg = getSmtpConfig();
          await smtpTransport(cfg).verify();
          ok.push("SMTP OK");
        } catch (err) {
          if (isAuthError(err)) {
            errors.push("SMTP auth failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD.");
          } else {
            errors.push(`SMTP error: ${(err as Error).message}`);
          }
        }
      }

      for (const message of ok) {
        console.log(chalk.green(`[ok] ${message}`));
      }
      for (const message of errors) {
        console.log(chalk.red(`[err] ${message}`));
      }

      if (errors.length > 0) {
        process.exitCode = 1;
      }
    });
}
