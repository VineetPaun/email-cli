#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import { getVersion, loadDotenvSafely } from "./config/project.js";
import { registerImportCommand } from "./commands/import.js";
import { registerInitCommand } from "./commands/init.js";
import { registerSendCommands } from "./commands/send.js";
import { registerValidateCommand } from "./commands/validate.js";

loadDotenvSafely();

const program = new Command();

program.name("postcli-ts").description("postcli-ts - Send handcrafted emails from your terminal.").version(getVersion());

registerSendCommands(program);
registerValidateCommand(program);
registerImportCommand(program);
registerInitCommand(program);

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
