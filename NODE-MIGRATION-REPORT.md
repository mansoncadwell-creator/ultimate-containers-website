# Node.js Migration Report

## Migrated
- Replaced PHP form endpoints with Express API routes.
- Replaced PHP review feed/token endpoints with Node.js endpoints.
- Replaced the PHP admin login/dashboard/actions with a Node.js API and static admin interface.
- Replaced MySQL/PDO access with a local SQLite database initialized on first run.
- Added SQLite-backed session storage, bcrypt password hashing, CSRF tokens, rate limits, validation and Helmet security headers.
- Added optional Nodemailer SMTP notifications. Quote persistence is independent of mail delivery.
- Retained public HTML/CSS/JS, images, legal pages, catalogue content and site navigation.

## API
- `GET /api/health`
- `GET /api/csrf`
- `POST /api/quotations`
- `GET /api/reviews`
- `POST /api/reviews`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/admin/dashboard`
- `PATCH /api/admin/quotations/:id`
- `PATCH /api/admin/reviews/:id`

## Local setup
See `README.md`. Node.js 22.5+ is required because the database now uses the built-in `node:sqlite` module; Node.js 24 is recommended. `npm install`, configure `.env`, provision the administrator with `npm run admin:create`, remove the initial password from `.env`, then `npm start`.

## Verification boundary
Static syntax and package checks can be performed in the build environment. Full end-to-end testing requires installing npm dependencies and running the app; SMTP delivery additionally requires valid SMTP credentials. No live email account, external database, or hosting account is included in this package. Do not describe email delivery or production deployment as tested unless separately verified.
