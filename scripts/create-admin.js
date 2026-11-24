require('dotenv').config();
const bcrypt=require('bcryptjs');
const db=require('../config/database');
(async()=>{
 const email=(process.env.ADMIN_EMAIL||'williamsjames9295@gmail.com').toLowerCase();
 const password=process.env.ADMIN_INITIAL_PASSWORD||'';
 if(!password || password.length<14){console.error('Set ADMIN_INITIAL_PASSWORD in .env to a unique password of at least 14 characters, run npm run admin:create, then remove it from .env.');process.exit(1);}
 const hash=await bcrypt.hash(password,12);
 db.prepare(`INSERT INTO admins(email,password_hash) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`).run(email,hash);
 console.log(`Administrator account provisioned for ${email}. Remove ADMIN_INITIAL_PASSWORD from .env now.`);
 db.close();
})().catch(e=>{console.error(e);process.exit(1)});
