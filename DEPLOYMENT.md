# Local Node.js Run Guide

This document covers running the project locally only. Hosting is intentionally outside the scope of this package revision.

1. Install Node.js 20+ (22 LTS recommended).
2. Extract the ZIP.
3. Open a terminal in the extracted `ultimate-containers` folder.
4. Run `npm install`.
5. Copy `.env.example` to `.env`.
6. Set a random `SESSION_SECRET` (32+ characters) and a private `ADMIN_INITIAL_PASSWORD` (14+ characters).
7. Run `npm run admin:create` once. Remove `ADMIN_INITIAL_PASSWORD` from `.env` immediately after success.
8. Run `npm start`.
9. Browse to `http://localhost:3000`; admin dashboard: `http://localhost:3000/admin/`.

The app initializes its SQLite database automatically in `data/`. No XAMPP, PHP, MySQL or phpMyAdmin is needed for this local configuration.

## Email
SMTP is optional for local testing. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and `MAIL_TO` in `.env` if you want quotation notification emails. Without valid SMTP configuration, quotations are still stored and visible in the dashboard.

## Troubleshooting
- `SESSION_SECRET` error: copy `.env.example` to `.env` and set a value at least 32 characters long.
- `npm install` errors: check internet access and run `npm install` again from the project folder.
- Port in use: set another `PORT` value in `.env`, then restart.
- Admin login fails: ensure `npm run admin:create` completed and use the configured admin email and password.
- Database files: do not delete `data/ultimate-containers.sqlite` or the `sessions` table in the same database if you want to keep records and sessions.
