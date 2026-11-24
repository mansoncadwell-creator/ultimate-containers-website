const db=require('../config/database');
for(const t of ['admins','quotations','reviews','quotation_audit','review_audit']) console.log(`${t}: ${db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n} rows`);
console.log('SQLite database ready.');db.close();
