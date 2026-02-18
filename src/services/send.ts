import fs from "node:fs";
import path from "node:path";
import boxen from "boxen";
import chalk from "chalk";
import { appendContacted, loadContactedEmails, loadContacts, type Contact, writeContacts } from "../contacts.js";
import { loadLinks } from "../links.js";
import { defaultSendLogPath, getVersion } from "../config/project.js";
import { SendLogRow, SendRunConfig, SendStatus } from "../types.js";
import { printRule } from "./console.js";
import { appendSendLog, buildCampaignKey, createRunId, loadSentEmailsForCampaign } from "./send-log.js";
import { getSmtpConfig, isAuthError, smtpTransport } from "./smtp.js";
import { templateEnv } from "./template.js";

function createLogRow(
  runId: string,
  campaignKey: string,
  config: SendRunConfig,
  contact: Contact,
  status: SendStatus,
  error: string,
  templatePath: string,
  subject: string
): SendLogRow {
  return {
    timestamp: new Date().toISOString(),
    run_id: runId,
    campaign_key: campaignKey,
    email: contact.email,
    name: contact.name,
    company: contact.company,
    template: path.basename(templatePath),
    role: config.role ?? "custom",
    subject,
    status,
    error
  };
}

function applyLimit(rows: Contact[], limit: number): Contact[] {
  if (limit > 0) {
    return rows.slice(0, limit);
  }
  return rows;
}

export async function runSend(config: SendRunConfig): Promise<void> {
  const templatePath = config.templatePath;
  const contactsPath = config.contactsPath;
  const logPath = config.logFile ? path.resolve(config.logFile) : defaultSendLogPath(contactsPath);
  const runId = createRunId();

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

  const fixedSubject = config.subject.trim();
  if (!fixedSubject) {
    throw new Error("Subject cannot be empty.");
  }

  const campaignKey = buildCampaignKey(contactsPath, templatePath, fixedSubject);
  const alreadyContacted = config.skipContacted ? loadContactedEmails(contactsPath) : new Set<string>();
  const previouslySent = config.resume ? loadSentEmailsForCampaign(logPath, campaignKey) : new Set<string>();

  let skippedContacted = 0;
  if (alreadyContacted.size > 0) {
    const filtered: Contact[] = [];
    for (const row of rows) {
      if (alreadyContacted.has(row.email)) {
        skippedContacted += 1;
        appendSendLog(
          logPath,
          createLogRow(runId, campaignKey, config, row, "skipped", "already_in_contacted", templatePath, fixedSubject)
        );
      } else {
        filtered.push(row);
      }
    }
    rows = filtered;
  }

  let skippedResumed = 0;
  if (previouslySent.size > 0) {
    const filtered: Contact[] = [];
    for (const row of rows) {
      if (previouslySent.has(row.email)) {
        skippedResumed += 1;
        appendSendLog(
          logPath,
          createLogRow(runId, campaignKey, config, row, "skipped", "already_sent_in_campaign", templatePath, fixedSubject)
        );
      } else {
        filtered.push(row);
      }
    }
    rows = filtered;
  }

  rows = applyLimit(rows, config.limit);

  if (rows.length === 0) {
    console.log(chalk.yellow("[warn] No contacts left to send after filters."));
    return;
  }

  console.log(`postcli ${getVersion()}`);
  printRule();
  console.log(chalk.gray(`Subject: ${fixedSubject}`));
  console.log(chalk.gray(`Log file: ${logPath}`));
  if (skippedContacted > 0) {
    console.log(chalk.gray(`Skipped ${skippedContacted} already in contacted.csv`));
  }
  if (skippedResumed > 0) {
    console.log(chalk.gray(`Resumed: skipped ${skippedResumed} already-sent contact(s)`));
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

  let cfg: ReturnType<typeof getSmtpConfig> | null = null;
  let transport: ReturnType<typeof smtpTransport> | null = null;
  let fromAddr = "";

  if (!dryRun) {
    cfg = getSmtpConfig();
    fromAddr = fromName ? `${fromName} <${cfg.address}>` : cfg.address;
    transport = smtpTransport(cfg);

    try {
      await transport.verify();
      console.log(chalk.green("[ok] SMTP connected"));
    } catch (err) {
      if (isAuthError(err)) {
        throw new Error("SMTP auth failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD (use Gmail App Password if 2FA).");
      }
      throw new Error(`SMTP error: ${(err as Error).message}`);
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
      appendSendLog(
        logPath,
        createLogRow(runId, campaignKey, config, contact, "failed", "template_render_error", templatePath, fixedSubject)
      );
      throw new Error(`Template error for ${contact.email || "?"}: ${(err as Error).message}`);
    }

    const toAddr = String(contact.email ?? "").trim();
    if (!toAddr) {
      appendSendLog(
        logPath,
        createLogRow(runId, campaignKey, config, contact, "skipped", "empty_email", templatePath, fixedSubject)
      );
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

      appendSendLog(
        logPath,
        createLogRow(runId, campaignKey, config, contact, "dry_run", "", templatePath, fixedSubject)
      );
      continue;
    }

    try {
      const activeCfg = cfg as ReturnType<typeof getSmtpConfig>;
      const activeTransport = transport as ReturnType<typeof smtpTransport>;
      const started = Date.now();
      await activeTransport.sendMail({
        from: fromAddr,
        to: toAddr,
        subject: fixedSubject,
        text: rendered,
        envelope: {
          from: activeCfg.address,
          to: [toAddr]
        }
      });
      const elapsedMs = Date.now() - started;
      console.log(chalk.green(`[ok] [${i + 1}/${total}] Sent to ${toAddr} (${elapsedMs}ms)`));
      sent.push(contact);

      appendSendLog(
        logPath,
        createLogRow(runId, campaignKey, config, contact, "sent", "", templatePath, fixedSubject)
      );
    } catch (err) {
      const errMsg = (err as Error).message;
      appendSendLog(
        logPath,
        createLogRow(runId, campaignKey, config, contact, "failed", errMsg, templatePath, fixedSubject)
      );

      if (isAuthError(err)) {
        throw new Error("SMTP auth failed. Check EMAIL_ADDRESS and EMAIL_PASSWORD (use Gmail App Password if 2FA).");
      }
      throw new Error(`[${i + 1}/${total}] Failed to send to ${toAddr}: ${errMsg}`);
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
