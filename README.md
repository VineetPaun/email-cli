# postcli-ts

`postcli-ts` is a terminal CLI for sending personalized outreach emails from CSV contacts using Nunjucks templates and SMTP.

## Current Defaults

- Default template for all roles: `templates/normal.html`
- Optional alternate template: `templates/platform.html`
- Roles: `fe`, `be`, `fullstack`
- `bun dev` runs `send-default`

## Project Files

- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/.env.example`: environment template
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/.env`: local runtime config
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/contacts.csv`: input contacts
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/contacted.csv`: sent contacts archive (created when mutate is enabled)
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/links.json`: links + `sender_name`
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/sent_log.csv`: send/dry-run log (default location)
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/templates/normal.html`: default email template
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/templates/platform.html`: alternate template
- `/Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts/src/data/platform-template-data.ts`: per-role copy blocks used by templates

## Setup

```bash
cd /Users/ztlab67/Documents/Personal_Projects/postcli/postcli-ts
bun install
cp .env.example .env
```

Update:

- `.env` (SMTP + defaults)
- `contacts.csv`
- `links.json`

## CLI Commands

Run help:

```bash
bun run src/cli.ts --help
bun run src/cli.ts <command> --help
```

### `init`

Creates starter files in a target directory.

```bash
bun run src/cli.ts init --dir .
```

Options:

- `--dir <target>`: directory to initialize (default `.`)

Creates:

- `.env.example`
- `contacts.csv`
- `links.json`
- all files from `templates/` (currently `normal.html` and `platform.html`)

### `import <json_file>`

Converts JSON into CSV contacts format.

```bash
bun run src/cli.ts import founders.json -o contacts.csv
```

Options:

- `-o, --output <path>`: output CSV path (default project `contacts.csv`)

Supported JSON input:

- flat objects: `{ "name": "...", "company": "...", "email": "..." }`
- YC-like objects with `founders[].name` and `companyEmails[]`

### `validate`

Validates template rendering, contacts, links file, and/or SMTP.

```bash
bun run src/cli.ts validate
```

Options:

- `--template <path>`: template path
- `--role <role>`: role used for template context when template is validated
- `--contacts <path>`: contacts CSV path
- `--links`: validate `links.json`
- `--smtp`: verify SMTP connection

Behavior with no flags:

- validates default role template
- validates default contacts file
- validates `links.json`
- validates SMTP

### `send`

Manual send command with explicit switches.

```bash
bun run src/cli.ts send --role fullstack --dry-run
```

Options:

- `--template <path>`: template path (optional when using `--role`)
- `--role <role>`: `fe | be | fullstack`
- `--contacts <path>`: contacts CSV path (default project `contacts.csv`)
- `--subject <subject>`: fixed subject override
- `--from-name <name>`: email display name in SMTP `from`
- `--limit <count>`: max contacts (default `0` = no limit)
- `--skip-contacted`: skip emails found in `contacted.csv`
- `--mutate`: append sent rows to `contacted.csv` and remove from contacts file
- `--dry-run`: render preview only, do not send
- `--no-resume`: disable resume behavior for previously sent rows in the same campaign
- `--log-file <path>`: custom send log path

### `send-default`

Default workflow command used by `bun dev`.

```bash
bun run src/cli.ts send-default
bun run src/cli.ts send-default --dry-run
```

Options:

- `--role <role>`: `fe | be | fullstack` (default `POSTCLI_ROLE` or `fullstack`)
- `--contacts <path>`: contacts path (default `CONTACTS_FILE` or project `contacts.csv`)
- `--subject <subject>`: fixed subject override
- `--from-name <name>`: sender display name (default `FROM_NAME`)
- `--limit <count>`: max contacts (default `SEND_LIMIT` or `0`)
- `--dry-run`: render preview only, do not send
- `--no-skip-contacted`: include rows already in `contacted.csv`
- `--no-mutate`: do not write `contacted.csv` and do not trim `contacts.csv`
- `--no-resume`: disable resume behavior from prior `sent_log.csv` entries for same campaign key
- `--log-file <path>`: custom log file path (default `SEND_LOG_FILE` or `sent_log.csv` next to contacts)

## NPM/Bun Scripts

- `bun run dev`: runs `send-default`
- `bun run dry`: runs `send-default --dry-run`
- `bun run validate`: runs `validate --smtp --links`
- `bun run build`: TypeScript build
- `bun run start`: runs compiled CLI from `dist/cli.js`

## Environment Variables

Required:

- `EMAIL_ADDRESS`
- `EMAIL_PASSWORD`
- `SMTP_SERVER`
- `SMTP_PORT`

Role/subject defaults:

- `POSTCLI_ROLE=fe|be|fullstack`
- `EMAIL_SUBJECT_FE`
- `EMAIL_SUBJECT_BE`
- `EMAIL_SUBJECT_FS`
- `EMAIL_SUBJECT_FULLSTACK` (also accepted)

`send-default` behavior defaults:

- `FROM_NAME`
- `CONTACTS_FILE`
- `SEND_LIMIT`
- `SKIP_CONTACTED`
- `MUTATE`
- `RESUME_ON_FAILURE`
- `SEND_LOG_FILE`

## Template Context

Available variables inside templates:

- Contact: `name`, `company`, `email`
- Links: `github`, `linkedin`, `portfolio`, `resume`, `x`, `sender_name`
- Role block: `role_template.badge`, `intro`, `stack[]`, `highlights[]`, `followup`, `ctaLabel`, `ctaHref`

`sender_name` precedence in send flow:

1. `--from-name` or `FROM_NAME` when using `send-default`
2. `links.json` `sender_name`
3. Template fallback (`"Your Name"`)

## Modifications in This Version

- Consolidated to a single project workflow (no separate campaign scaffolding).
- Added role-based copy data in `src/data/platform-template-data.ts`.
- Added default role subjects for FE/BE/Fullstack.
- Added robust send logging in `sent_log.csv` with campaign key + status.
- Added resume behavior using `sent_log.csv` to skip already-sent recipients in the same campaign.
- Added optional mutation flow to move sent recipients into `contacted.csv`.
- Added JSON import command for YC-style and flat contact payloads.
- Added HTML email support with plain-text auto-conversion for SMTP text body.
- Added `templates/normal.html` and made it the default template for all roles.
- Kept `templates/platform.html` as an alternate template.
- Updated links section layout in platform template to render in rows.
- Updated sign-off fallback to avoid blank sender name.

## Examples

Dry-run with default role:

```bash
bun run dry
```

Send FE role with explicit template and no mutation:

```bash
bun run src/cli.ts send --role fe --template templates/platform.html --no-resume --dry-run
```

Real send with defaults:

```bash
bun run dev
```
