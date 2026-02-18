import fs from "node:fs";
import path from "node:path";

export type Links = {
  x: string;
  linkedin: string;
  github: string;
  portfolio: string;
  resume: string;
  sender_name: string;
};

function emptyLinks(): Links {
  return {
    x: "",
    linkedin: "",
    github: "",
    portfolio: "",
    resume: "",
    sender_name: ""
  };
}

export function loadLinks(workDir?: string): Links {
  const dirs: string[] = [];
  if (workDir) {
    dirs.push(path.resolve(workDir));
  }
  try {
    dirs.push(process.cwd());
  } catch {
    // Ignore invalid cwd and continue.
  }

  for (const dir of dirs) {
    const filePath = path.join(dir, "links.json");
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      return {
        x: String(data.x ?? ""),
        linkedin: String(data.linkedin ?? ""),
        github: String(data.github ?? ""),
        portfolio: String(data.portfolio ?? ""),
        resume: String(data.resume ?? ""),
        sender_name: String(data.sender_name ?? "")
      };
    } catch {
      return emptyLinks();
    }
  }

  return emptyLinks();
}
