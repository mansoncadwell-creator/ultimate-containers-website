# Local Node.js Verification Checklist

- [ ] Node.js 22.5+ installed (Node.js 24 recommended).
- [ ] `npm install` completes without errors.
- [ ] `.env` created and `SESSION_SECRET` configured.
- [ ] Admin account created with `npm run admin:create`.
- [ ] `ADMIN_INITIAL_PASSWORD` removed from `.env` after setup.
- [ ] `npm start` starts the server without errors.
- [ ] Homepage, contact page, catalogue and reviews page load at `http://localhost:3000`.
- [ ] Submit a test quotation and confirm it appears in `/admin/`.
- [ ] Submit a test review and confirm it is pending and not public.
- [ ] Approve a review only after display consent is present; confirm it appears on the reviews page.
- [ ] Test quotation status changes, review hide/reject/edit, search and delete confirmation.
- [ ] Configure SMTP and send a test quotation email if notifications are required.

This checklist is not marked complete by packaging alone. Run each item on the user's computer before treating the local application as fully verified.
