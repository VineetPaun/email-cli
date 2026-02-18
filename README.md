# postcli-ts

Single-project email CLI. Everything lives inside this folder.

## What changed

- No separate campaign folder needed.
- Use one command to send: `bun dev`.
- 3 templates included:
  - `templates/frontend.txt`
  - `templates/backend.txt`
  - `templates/fullstack.txt`
- Subject is fixed for the whole run via `EMAIL_SUBJECT`.

## Setup (once)

```bash
cd /Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts
bun install
cp .env.example .env
```

Edit these files in this same folder:

- `.env`
- `contacts.csv`
- `links.json`
- `templates/frontend.txt` / `templates/backend.txt` / `templates/fullstack.txt`

In `.env`, set:

- `EMAIL_ADDRESS`
- `EMAIL_PASSWORD` (Gmail App Password)
- `SMTP_SERVER`
- `SMTP_PORT`
- `EMAIL_SUBJECT` (single subject for all emails)
- `POSTCLI_ROLE=fe|be|fullstack`

## Send emails

```bash
bun dev
```

That runs `send-default` with project defaults.

## Useful commands

```bash
bun run validate
bun run dry
bun run src/cli.ts send-default --role fe --dry-run
bun run src/cli.ts import data.json -o contacts.csv
```

## Optional cleanup

If you no longer want the old folder, remove it manually:

```bash
rm -r /Users/ztlab67/Documents/Personal_Projects/postcli/my-campaign
```
