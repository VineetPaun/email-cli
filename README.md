# postcli-ts

Single-project email CLI. Everything lives inside this folder.

## What changed

- No separate campaign folder needed.
- Use one command to send: `bun dev`.
- 3 templates included:
  - `templates/frontend.txt`
  - `templates/backend.txt`
  - `templates/fullstack.txt`
- Different default subject per template role:
  - `fe`: `Frontend Engineer - React / Next.js`
  - `be`: `Backend Engineer - APIs & Scalable Systems`
  - `fullstack`: `Full Stack Engineer - TypeScript / Node.js`
- `sent_log.csv` is written for delivery tracking.
- Resume-on-failure is enabled by default (already sent rows in the same campaign are skipped).
- Sending uses SMTP.

## Setup (once)

```bash
cd /Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts
bun install
cp .env.example .env
```

Edit these files in this folder:

- `.env`
- `contacts.csv`
- `links.json`
- `templates/frontend.txt` / `templates/backend.txt` / `templates/fullstack.txt`

In `.env`, set:

- `EMAIL_ADDRESS`
- `EMAIL_PASSWORD` (for Gmail, use App Password)
- `SMTP_SERVER`
- `SMTP_PORT`
- `POSTCLI_ROLE=fe|be|fullstack`

Optional:

- `EMAIL_SUBJECT_FE` / `EMAIL_SUBJECT_BE` / `EMAIL_SUBJECT_FS`
- `RESUME_ON_FAILURE=true|false`
- `SEND_LOG_FILE=sent_log.csv`

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
bun run src/cli.ts send-default --no-resume
```
