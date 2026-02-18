import { Command } from "commander";
import { defaultContactsPath, defaultSendLogPath, defaultSubject, normalizeRole, resolvePath, resolveTemplatePath } from "../config/project.js";
import { runSend } from "../services/send.js";
import { envBoolean, parseInteger } from "../utils/primitives.js";

export function registerSendCommands(program: Command): void {
  program
    .command("send")
    .option("--template <path>", "Path to email template (optional if using --role).")
    .option("--role <role>", "Template role: fe | be | fullstack.")
    .option("--contacts <path>", "Path to CSV contacts file.", defaultContactsPath())
    .option("--subject <subject>", "Same subject for every email.", defaultSubject())
    .option("--from-name <name>", "Display name for sender (default: EMAIL_ADDRESS).")
    .option("--limit <count>", "Max contacts to send to (0 = all).", "0")
    .option("--skip-contacted", "Skip emails already in contacted.csv.")
    .option("--mutate", "Append sent contacts to contacted.csv and remove them from contacts file (opt-in).")
    .option("--dry-run", "Preview emails without sending.")
    .option("--no-resume", "Disable resume behavior and send from the top of the list.")
    .option("--log-file <path>", "Path to send log CSV.")
    .action(async (opts) => {
      const contactsPath = resolvePath(String(opts.contacts ?? defaultContactsPath()));
      await runSend({
        templatePath: resolveTemplatePath(opts.role ? String(opts.role) : undefined, opts.template ? String(opts.template) : undefined),
        role: opts.role ? normalizeRole(String(opts.role)) : undefined,
        contactsPath,
        subject: String(opts.subject ?? defaultSubject()),
        fromName: opts.fromName ? String(opts.fromName) : undefined,
        limit: parseInteger(String(opts.limit ?? "0"), 0),
        skipContacted: Boolean(opts.skipContacted),
        mutate: Boolean(opts.mutate),
        dryRun: Boolean(opts.dryRun),
        resume: opts.resume ?? true,
        logFile: opts.logFile ? resolvePath(String(opts.logFile)) : defaultSendLogPath(contactsPath)
      });
    });

  program
    .command("send-default")
    .description("Send using project defaults. This is what `bun dev` runs.")
    .option("--role <role>", "Template role: fe | be | fullstack (default from POSTCLI_ROLE or fullstack).")
    .option("--contacts <path>", "Path to CSV contacts file.", process.env.CONTACTS_FILE ?? defaultContactsPath())
    .option("--subject <subject>", "Same subject for every email.", defaultSubject())
    .option("--from-name <name>", "Display name for sender (default: FROM_NAME or EMAIL_ADDRESS).")
    .option("--limit <count>", "Max contacts to send to (0 = all).", process.env.SEND_LIMIT ?? "0")
    .option("--dry-run", "Preview emails without sending.")
    .option("--no-skip-contacted", "Include emails already present in contacted.csv.")
    .option("--no-mutate", "Do not write contacted.csv or mutate contacts.csv.")
    .option("--no-resume", "Disable resume behavior.")
    .option("--log-file <path>", "Path to send log CSV.", process.env.SEND_LOG_FILE)
    .action(async (opts) => {
      const contactsPath = resolvePath(String(opts.contacts ?? process.env.CONTACTS_FILE ?? defaultContactsPath()));
      const role = normalizeRole(opts.role ? String(opts.role) : undefined);
      await runSend({
        templatePath: resolveTemplatePath(role),
        role,
        contactsPath,
        subject: String(opts.subject ?? defaultSubject()),
        fromName: opts.fromName ? String(opts.fromName) : process.env.FROM_NAME,
        limit: parseInteger(String(opts.limit ?? process.env.SEND_LIMIT ?? "0"), 0),
        skipContacted: opts.skipContacted ?? envBoolean("SKIP_CONTACTED", true),
        mutate: opts.mutate ?? envBoolean("MUTATE", true),
        dryRun: Boolean(opts.dryRun),
        resume: opts.resume ?? envBoolean("RESUME_ON_FAILURE", true),
        logFile: opts.logFile ? resolvePath(String(opts.logFile)) : defaultSendLogPath(contactsPath)
      });
    });
}
