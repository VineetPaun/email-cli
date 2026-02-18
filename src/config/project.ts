import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { TemplateRole } from "../types.js";

export const ROLE_TEMPLATE_FILES: Record<TemplateRole, string> = {
  fe: "frontend.txt",
  be: "backend.txt",
  fullstack: "fullstack.txt"
};

export const ROLE_SUBJECT_DEFAULTS: Record<TemplateRole, string> = {
  fe: "Frontend Engineer - React / Next.js",
  be: "Backend Engineer - APIs & Scalable Systems",
  fullstack: "Full Stack Engineer - TypeScript / Node.js"
};

export function resolveProjectRoot(): string {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(scriptDir, "../.."),
    path.resolve(scriptDir, "../../.."),
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

  return path.resolve(scriptDir, "../..");
}

export const PROJECT_ROOT = resolveProjectRoot();

export function loadDotenvSafely(): void {
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

export function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(PROJECT_ROOT, inputPath);
}

export function normalizeRole(input?: string): TemplateRole {
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

export function resolveTemplatePath(roleInput?: string, explicitTemplate?: string): string {
  if (explicitTemplate) {
    return resolvePath(explicitTemplate);
  }

  const role = normalizeRole(roleInput);
  const filename = ROLE_TEMPLATE_FILES[role];
  return path.join(PROJECT_ROOT, "templates", filename);
}

export function defaultContactsPath(): string {
  return path.join(PROJECT_ROOT, "contacts.csv");
}

export function inferRoleFromTemplatePath(templatePath?: string): TemplateRole | undefined {
  if (!templatePath) {
    return undefined;
  }

  const base = path.basename(templatePath).toLowerCase();
  if (base.includes("front")) {
    return "fe";
  }
  if (base.includes("back")) {
    return "be";
  }
  if (base.includes("full")) {
    return "fullstack";
  }

  return undefined;
}

export function defaultSubject(roleInput?: string | TemplateRole): string {
  const role = normalizeRole(roleInput);
  if (role === "fe") {
    return String(process.env.EMAIL_SUBJECT_FE ?? ROLE_SUBJECT_DEFAULTS.fe).trim() || ROLE_SUBJECT_DEFAULTS.fe;
  }
  if (role === "be") {
    return String(process.env.EMAIL_SUBJECT_BE ?? ROLE_SUBJECT_DEFAULTS.be).trim() || ROLE_SUBJECT_DEFAULTS.be;
  }
  return (
    String(process.env.EMAIL_SUBJECT_FS ?? process.env.EMAIL_SUBJECT_FULLSTACK ?? ROLE_SUBJECT_DEFAULTS.fullstack).trim() ||
    ROLE_SUBJECT_DEFAULTS.fullstack
  );
}

export function defaultSendLogPath(contactsPath: string): string {
  return path.join(path.dirname(resolvePath(contactsPath)), "sent_log.csv");
}

export function getVersion(): string {
  try {
    const pkgRaw = fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as { version?: string };
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}
