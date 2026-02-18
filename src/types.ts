export type TemplateRole = "fe" | "be" | "fullstack";

export type SmtpConfig = {
  address: string;
  password: string;
  server: string;
  port: number;
};

export type SendRunConfig = {
  templatePath: string;
  contactsPath: string;
  subject: string;
  fromName?: string;
  limit: number;
  skipContacted: boolean;
  mutate: boolean;
  dryRun: boolean;
  resume: boolean;
  logFile?: string;
  role?: TemplateRole;
};

export type SendStatus = "sent" | "failed" | "skipped" | "dry_run";

export type SendLogRow = {
  timestamp: string;
  run_id: string;
  campaign_key: string;
  email: string;
  name: string;
  company: string;
  template: string;
  role: string;
  subject: string;
  status: SendStatus;
  error: string;
};
