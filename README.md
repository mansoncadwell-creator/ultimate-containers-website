# Ultimate Containers Inc. — Node.js Website

This version replaces the former PHP backend with a Node.js + Express application. The existing public HTML pages, styling, images, catalogue and company content are retained.

## Requirements
- Node.js 22.5 or newer (Node.js 22 LTS recommended)
- npm (included with Node.js)
- Internet access for the first `npm install`

No XAMPP installation is required. SQLite is used for the local database and is created automatically in `data/ultimate-containers.sqlite`.

## Run locally (Windows PowerShell / Command Prompt)
1. Extract the project ZIP to a normal folder, for example `C:\\Ultimate-Containers`.
2. Open Terminal in that folder (the folder containing `package.json`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create your local environment file:
   - Windows PowerShell: `Copy-Item .env.example .env`
   - Command Prompt: `copy .env.example .env`
5. Open `.env`. Set `SESSION_SECRET` to a long random string of at least 32 characters. Set `ADMIN_INITIAL_PASSWORD` to a unique password of at least 14 characters. Do not send this password to anyone.
6. Create the private administrator account:
   ```bash
   npm run admin:create
   ```
7. Immediately remove the value of `ADMIN_INITIAL_PASSWORD` from `.env` and save the file.
8. Start the website:
   ```bash
   npm start
   ```
9. Open `http://localhost:3000`.
10. Open the private dashboard at `http://localhost:3000/admin/` and sign in with the administrator email configured in `.env` and the password you created.

For development with automatic server restart, use `npm run dev`.

## Features
- Quotation form: `POST /api/quotations`; requests are saved before notification attempts.
- Optional SMTP email notification via Nodemailer. If SMTP is not configured or delivery fails, the enquiry remains saved in the dashboard.
- Customer review submission: `POST /api/reviews`; new reviews are pending and not publicly displayed.
- Public review feed: `GET /api/reviews`; only approved reviews with separate display consent are returned.
- Unified admin workspace: `/admin/`; quotation status management, review moderation, search/filter, audit history and confirmed permanent deletion.
- Session-backed CSRF protection, HTTP security headers, request size limits, input validation, rate limiting, password hashing and SQLite-backed sessions.

## Optional email configuration
Set these in `.env` using details from an SMTP provider you control:
- `SMTP_HOST`
- `SMTP_PORT` (usually 587)
- `SMTP_SECURE` (`false` for STARTTLS on 587; `true` for implicit TLS on 465)
- `SMTP_USER`
- `SMTP_PASSWORD`
- `MAIL_FROM` (an address authorized by your SMTP provider)
- `MAIL_TO` (defaults to `ultimatecontainersinc@gmail.com` if configured in `.env.example`)

Never commit or share `.env`. The website does not need SMTP to save enquiries locally.

## Data and backups
The SQLite database is stored at `data/ultimate-containers.sqlite`; sessions are stored in the same SQLite database. Stop the server before copying the database files for a consistent manual backup. Do not delete these files if you want to retain enquiries, reviews or administrator accounts.

## Important notes
- This is a local-development package. Production deployment, HTTPS, SMTP delivery, external access and backup/restore procedures have not been verified here.
- The old PHP implementation has been removed from the runnable package. The Node.js backend is the active backend.
- The former MySQL schema is not used by this local version. A new SQLite database is initialized automatically. If an old live MySQL database ever contains real records, those records need a deliberate migration/export before switching systems; this ZIP does not silently migrate an external database.
- Product images are illustrative catalogue imagery, not confirmation of live inventory.
- Keep Node.js dependencies updated and use a strong private administrator password.
