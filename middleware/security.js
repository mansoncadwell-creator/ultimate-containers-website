const crypto = require('node:crypto');
function csrfToken(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}
function verifyCsrf(req, res, next) {
  const supplied = req.get('x-csrf-token') || req.body?.csrf_token || req.body?.csrf;
  const expected = req.session?.csrfToken;
  if (!supplied || !expected || Buffer.byteLength(String(supplied)) !== Buffer.byteLength(String(expected)) || !crypto.timingSafeEqual(Buffer.from(String(supplied)), Buffer.from(String(expected))) ) {
    return res.status(403).json({ success:false, message:'Security token expired. Refresh the page and try again.' });
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session?.adminId || req.session.adminEmail !== (process.env.ADMIN_EMAIL || 'williamsjames9295@gmail.com').toLowerCase()) {
    return res.status(401).json({ success:false, message:'Administrator sign-in required.' });
  }
  next();
}
module.exports = { csrfToken, verifyCsrf, requireAdmin };
