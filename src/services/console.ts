import chalk from "chalk";

export function printRule(label?: string): void {
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
