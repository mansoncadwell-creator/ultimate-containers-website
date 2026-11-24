# Unified Admin Dashboard — Node.js Edition

The previous PHP/MySQL implementation has been superseded by the Node.js/Express application in this package. The active unified administrator workspace is `/admin/` and uses the local SQLite database initialized by `config/database.js`.

The dashboard combines quotation management and customer-review moderation, including search, quotation status filtering, review approval (only with display consent), hide/reject/edit/delete actions, confirmed quotation deletion and activity history.

See `NODE-MIGRATION-REPORT.md` and `README.md` for the current architecture and setup. This report does not claim that a local live test, SMTP delivery or production deployment has occurred.
