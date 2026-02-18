#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Command } from "commander";
import nunjucks from "nunjucks";
import nodemailer from "nodemailer";
import boxen from "boxen";
import chalk from "chalk";
import { appendContacted, loadContactedEmails, loadContacts, type Contact, writeContacts } from "./contacts.js";
import { loadLinks } from "./links.js";

type TemplateRole = "fe" | "be" | "fullstack";

type SmtpConfig = {
  address: string;
  password: string;
  server: string;
  port: number;
};

type SendRunConfig = {
  templatePath: string;
  contactsPath: string;
  subject: string;
  fromName?: string;
  delay: number;
  limit: number;
  skipContacted: boolean;
  mutate: boolean;
  dryRun: boolean;
};

const ROLE_TEMPLATE_FILES: Record<TemplateRole, string> = {
  fe: "frontend.txt",
  be: "backend.txt",
  fullstack: "fullstack.txt"
};

function resolveProjectRoot(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(scriptDir, ".."),
    path.resolve(scriptDir, "../.."),
    process.env.PWD ? path.resolve(process.env.PWD) : null
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      if (fs.existsSync(path.join(candidate, "package.json"))) {
        return candidate;
      }
    } catch {
      // Continue checking candidates.
    }
  }

  return path.resolve(scriptDir, "..");
}

const PROJECT_ROOT = resolveProjectRoot();

function loadDotenvSafely(): void {
  const candidates = [
    path.join(PROJECT_ROOT, ".env"),
    process.env.PWD ? path.join(path.resolve(process.env.PWD), ".env") : null
  ];

  for (const envPath of candidates) {
    if (!envPath) {
      continue;
    }

    try {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        return;
      }
    } catch {
      // Continue trying fallback paths.
    }
  }
}

loadDotenvSafely();

function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(PROJECT_ROOT, inputPath);
}

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeRole(input?: string): TemplateRole {
  const raw = String(input ?? process.env.POSTCLI_ROLE ?? "fullstack").trim().toLowerCase();

  if (["fe", "frontend", "front-end"].includes(raw)) {
    return "fe";
  }

  if (["be", "backend", "back-end"].includes(raw)) {
    return "be";
  }

  if (["fullstack", "full-stack", "fs"].includes(raw)) {
    return "fullstack";
  }

  return "fullstack";
}

function resolveTemplatePath(roleInput?: string, explicitTemplate?: string): string {
  if (explicitTemplate) {
    return resolvePath(explicitTemplate);
  }

  const role = normalizeRole(roleInput);
  const filename = ROLE_TEMPLATE_FILES[role];
  return path.join(PROJECT_ROOT, "templates", filename);
}

function defaultContactsPath(): string {
  return path.join(PROJECT_ROOT, "contacts.csv");
}

function defaultSubject(): string {
  const subject = String(process.env.EMAIL_SUBJECT ?? "Quick question about your team").trim();
  return subject || "Quick question about your team";
}

function envBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getVersion(): string {
  try {
    const pkgRaw = fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as { version?: string };
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function printRule(label?: string): void {
  const width = Math.max(40, process.stdout.columns ?? 80);
  if (!label) {
    console.log(chalk.gray("-".repeat(width)));
    return;
  }

  const text = ` ${label} `;
  const left = Math.floor((width - text.length) / 2);
  const right = Math.max(0, width - text.length - left);
  console.log(chalk.yellow(`${"-".repeat(left)}${text}${"-".repeat(right)}`));
}

function getSmtpConfig(): SmtpConfig {
  const required = ["EMAIL_ADDRESS", "EMAIL_PASSWORD", "SMTP_SERVER", "SMTP_PORT"] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}. Add them to .env`);
  }

  const port = parseInteger(process.env.SMTP_PORT as string, Number.NaN);
  if (Number.isNaN(port)) {
    throw new Error("SMTP_PORT must be a number");
  }

  return {
    address: process.env.EMAIL_ADDRESS as string,
    password: process.env.EMAIL_PASSWORD as string,
    server: process.env.SMTP_SERVER as string,
    port
  };
}

function smtpTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.server,
    port: cfg.port,
    secure: false,
    auth: {
      user: cfg.address,
      pass: cfg.password
    },
    connectionTimeout: 10_000
  });
}

function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const code = (err as Error & { code?: string }).code;
  return code === "EAUTH" || /auth/i.test(err.message);
}

function templateEnv(baseDir: string): nunjucks.Environment {
  return new nunjucks.Environment(new nunjucks.FileSystemLoader(baseDir), {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: false,
    lstripBlocks: false
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSend(config: SendRunConfig): Promise<void> {
  const templatePath = config.templatePath;
  const contactsPath = config.contactsPath;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  if (!fs.existsSync(contactsPath)) {
    throw new Error(`Contacts file not found: ${contactsPath}`);
  }

  let rows: Contact[];
  try {
    rows = loadContacts(contactsPath);
  } catch (err) {
    throw new Error((err as Error).message);
  }

  if (rows.length === 0) {
    console.log(chalk.yellow("[warn] No contacts in CSV."));
    return;
  }

  const alreadyContacted = config.skipContacted ? loadContactedEmails(contactsPath) : new Set<string>();
  if (alreadyContacted.size > 0) {
    rows = rows.filter((row) => !alreadyContacted.has(row.email));
    if (rows.length === 0) {
      console.log(chalk.yellow("[warn] All contacts already in contacted.csv. Nothing to send."));
      return;
    }
  }

  if (config.limit > 0) {
    rows = rows.slice(0, config.limit);
  }

  const fixedSubject = config.subject.trim();
  if (!fixedSubject) {
    throw new Error("Subject cannot be empty.");
  }

  console.log(`postcli ${getVersion()}`);
  printRule();
  console.log(chalk.gray(`Subject: ${fixedSubject}`));
  if (alreadyContacted.size > 0) {
    console.log(chalk.gray(`Skipped ${alreadyContacted.size} already contacted`));
  }
  if (config.limit > 0) {
    console.log(chalk.gray(`Limited to ${config.limit} contact(s)`));
  }
  console.log(chalk.green(`[ok] Loaded ${rows.length} contact(s)`));

  const env = templateEnv(path.dirname(templatePath));
  const templateName = path.basename(templatePath);

  try {
    env.getTemplate(templateName, true);
  } catch (err) {
    throw new Error(`Template error: ${(err as Error).message}`);
  }

  console.log(chalk.green("[ok] Template validated"));

  const links = loadLinks(path.dirname(contactsPath));
  const dryRun = config.dryRun;
  const fromName = config.fromName?.trim();

  let cfg: SmtpConfig | null = null;
  let fromAddr = "";

  if (!dryRun) {
    cfg = getSmtpConfig();
    fromAddr = fromName ? `${fromName} <${cfg.address}>` : cfg.address;

    try {
      await smtpTransport(cfg).verify();
      console.log(chalk.green("[ok] SMTP connected"));
    } catch (err) {
      if (isAuthError(err)) {
        throw new Error(
          "SMTP auth failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD (use Gmail App Password if 2FA)."
        );
      }
      throw new Error(`SMTP error: ${(err as Error).message}`);
    }

    if (config.delay === 0 && rows.length > 1) {
      console.log(chalk.yellow("[warn] No delay set. Gmail may throttle high volume sends."));
    }
  } else {
    printRule("DRY RUN");
    console.log(chalk.yellow("[info] Dry run mode - no emails sent"));
    console.log();
  }

  const total = rows.length;
  const sent: Contact[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const contact = rows[i];
    const ctx = {
      ...links,
      ...contact
    };

    let rendered = "";

    try {
      rendered = env.render(templateName, ctx);
    } catch (err) {
      throw new Error(`Template error for ${contact.email || "?"}: ${(err as Error).message}`);
    }

    const toAddr = String(contact.email ?? "").trim();
    if (!toAddr) {
      continue;
    }

    if (dryRun) {
      const title = `To: ${toAddr} | Subject: ${fixedSubject}`;
      console.log(
        boxen(rendered, {
          title,
          padding: 1,
          borderStyle: "round",
          borderColor: "blue",
          titleAlignment: "left"
        })
      );
      continue;
    }

    try {
      const started = Date.now();
      const perSendTransport = smtpTransport(cfg as SmtpConfig);
      await perSendTransport.sendMail({
        from: fromAddr,
        to: toAddr,
        subject: fixedSubject,
        text: rendered,
        envelope: {
          from: (cfg as SmtpConfig).address,
          to: [toAddr]
        }
      });
      const elapsedMs = Date.now() - started;
      console.log(chalk.green(`[ok] [${i + 1}/${total}] Sent to ${toAddr} (${elapsedMs}ms)`));
      sent.push(contact);
    } catch (err) {
      if (isAuthError(err)) {
        throw new Error(
          "SMTP auth failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD (use Gmail App Password if 2FA)."
        );
      }
      throw new Error(`[${i + 1}/${total}] Failed to send to ${toAddr}: ${(err as Error).message}`);
    }

    if (config.delay > 0 && i < rows.length - 1) {
      await sleep(config.delay * 1000);
    }
  }

  if (!dryRun && sent.length > 0 && config.mutate) {
    const contactedPath = path.join(path.dirname(contactsPath), "contacted.csv");
    appendContacted(contactedPath, sent);
    const sentEmails = new Set(sent.map((row) => row.email));
    const remaining = rows.filter((row) => !sentEmails.has(row.email));
    writeContacts(contactsPath, remaining);
    console.log(chalk.green(`[ok] Moved ${sent.length} contact(s) to ${contactedPath}`));
  }
}

const program = new Command();

program.name("postcli-ts").description("postcli-ts - Send handcrafted emails from your terminal.").version(getVersion());

program
  .command("send")
  .option("--template <path>", "Path to email template (optional if using --role).")
  .option("--role <role>", "Template role: fe | be | fullstack.")
  .option("--contacts <path>", "Path to CSV contacts file.", defaultContactsPath())
  .option("--subject <subject>", "Same subject for every email.", defaultSubject())
  .option("--from-name <name>", "Display name for sender (default: EMAIL_ADDRESS).")
  .option("--delay <seconds>", "Seconds to wait between sends (default: 0).", "0")
  .option("--limit <count>", "Max contacts to send to (0 = all).", "0")
  .option("--skip-contacted", "Skip emails already in contacted.csv.")
  .option("--mutate", "Append sent contacts to contacted.csv and remove them from contacts file (opt-in).")
  .option("--dry-run", "Preview emails without sending.")
  .action(async (opts) => {
    await runSend({
      templatePath: resolveTemplatePath(opts.role ? String(opts.role) : undefined, opts.template ? String(opts.template) : undefined),
      contactsPath: resolvePath(String(opts.contacts ?? defaultContactsPath())),
      subject: String(opts.subject ?? defaultSubject()),
      fromName: opts.fromName ? String(opts.fromName) : undefined,
      delay: parseInteger(String(opts.delay ?? "0"), 0),
      limit: parseInteger(String(opts.limit ?? "0"), 0),
      skipContacted: Boolean(opts.skipContacted),
      mutate: Boolean(opts.mutate),
      dryRun: Boolean(opts.dryRun)
    });
  });

program
  .command("send-default")
  .description("Send using project defaults. This is what `bun dev` runs.")
  .option("--role <role>", "Template role: fe | be | fullstack (default from POSTCLI_ROLE or fullstack).")
  .option("--contacts <path>", "Path to CSV contacts file.", process.env.CONTACTS_FILE ?? defaultContactsPath())
  .option("--subject <subject>", "Same subject for every email.", defaultSubject())
  .option("--from-name <name>", "Display name for sender (default: FROM_NAME or EMAIL_ADDRESS).")
  .option("--delay <seconds>", "Seconds to wait between sends.", process.env.SEND_DELAY ?? "0")
  .option("--limit <count>", "Max contacts to send to (0 = all).", process.env.SEND_LIMIT ?? "0")
  .option("--dry-run", "Preview emails without sending.")
  .option("--no-skip-contacted", "Include emails already present in contacted.csv.")
  .option("--no-mutate", "Do not write contacted.csv or mutate contacts.csv.")
  .action(async (opts) => {
    await runSend({
      templatePath: resolveTemplatePath(opts.role ? String(opts.role) : undefined),
      contactsPath: resolvePath(String(opts.contacts ?? process.env.CONTACTS_FILE ?? defaultContactsPath())),
      subject: String(opts.subject ?? defaultSubject()),
      fromName: opts.fromName ? String(opts.fromName) : process.env.FROM_NAME,
      delay: parseInteger(String(opts.delay ?? process.env.SEND_DELAY ?? "0"), 0),
      limit: parseInteger(String(opts.limit ?? process.env.SEND_LIMIT ?? "0"), 0),
      skipContacted: opts.skipContacted ?? envBoolean("SKIP_CONTACTED", true),
      mutate: opts.mutate ?? envBoolean("MUTATE", true),
      dryRun: Boolean(opts.dryRun)
    });
  });

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
      template = resolveTemplatePath(opts.role ? String(opts.role) : undefined);
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

program
  .command("init")
  .option("--dir <target>", "Directory to init (default: current).", ".")
  .description("Create .env.example, contacts.csv, links.json, and templates/ in the target directory.")
  .action((opts) => {
    const dst = resolvePath(String(opts.dir));
    fs.mkdirSync(dst, { recursive: true });

    const rootFiles = [".env.example", "contacts.csv", "links.json"];
    for (const file of rootFiles) {
      const source = path.join(PROJECT_ROOT, file);
      const target = path.join(dst, file);

      if (!fs.existsSync(source)) {
        throw new Error(`Missing source file: ${source}`);
      }

      if (fs.existsSync(target)) {
        console.log(chalk.yellow(`[skip] ${file} exists`));
      } else {
        fs.copyFileSync(source, target);
        console.log(chalk.green(`[ok] Created ${target}`));
      }
    }

    const srcTemplatesDir = path.join(PROJECT_ROOT, "templates");
    const dstTemplatesDir = path.join(dst, "templates");
    fs.mkdirSync(dstTemplatesDir, { recursive: true });

    for (const file of Object.values(ROLE_TEMPLATE_FILES)) {
      const source = path.join(srcTemplatesDir, file);
      const target = path.join(dstTemplatesDir, file);

      if (!fs.existsSync(source)) {
        throw new Error(`Missing source template: ${source}`);
      }

      if (fs.existsSync(target)) {
        console.log(chalk.yellow(`[skip] templates/${file} exists`));
      } else {
        fs.copyFileSync(source, target);
        console.log(chalk.green(`[ok] Created ${target}`));
      }
    }
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`[err] ${message}`));
    process.exitCode = 1;
  }
}

void main();
