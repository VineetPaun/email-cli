import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { PROJECT_ROOT, ROLE_TEMPLATE_FILES, resolvePath } from "../config/project.js";

export function registerInitCommand(program: Command): void {
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
}
