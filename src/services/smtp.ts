import nodemailer from "nodemailer";
import { parseInteger } from "../utils/primitives.js";

export type SmtpConfig = {
  address: string;
  password: string;
  server: string;
  port: number;
};

export function getSmtpConfig(): SmtpConfig {
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

export function smtpTransport(cfg: SmtpConfig) {
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

export function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const code = (err as Error & { code?: string }).code;
  return code === "EAUTH" || /auth/i.test(err.message);
}
