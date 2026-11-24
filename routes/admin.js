const express=require('express');
const rateLimit=require('express-rate-limit');
const bcrypt=require('bcryptjs');
const db=require('../config/database');
const {verifyCsrf,requireAdmin}=require('../middleware/security');
const router=express.Router();
const ADMIN=(process.env.ADMIN_EMAIL||'williamsjames9295@gmail.com').toLowerCase();
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many sign-in attempts. Wait 15 minutes and try again.'}});
router.get('/me',requireAdmin,(req,res)=>res.json({email:req.session.adminEmail}));
router.post('/login',loginLimiter,verifyCsrf,async(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
 const row=db.prepare('SELECT id,email,password_hash FROM admins WHERE email=? AND email=?').get(email,ADMIN);
 if(!row || !(await bcrypt.compare(password,row.password_hash))) return res.status(401).json({success:false,message:'Sign-in failed. Check your details.'});
 await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
 req.session.adminId=row.id;req.session.adminEmail=row.email;req.session.csrfToken=require('node:crypto').randomBytes(32).toString('hex');
 db.prepare("UPDATE admins SET last_login_at=datetime('now') WHERE id=?").run(row.id);
 res.json({success:true,email:row.email,csrf_token:req.session.csrfToken});
});
router.post('/logout',requireAdmin,verifyCsrf,(req,res)=>req.session.destroy(()=>res.json({success:true})));
router.get('/dashboard',requireAdmin,(req,res)=>{
 const q=db.prepare(`SELECT * FROM quotations WHERE (@term='' OR customer_name LIKE @like OR customer_email LIKE @like OR container_type LIKE @like OR delivery_city LIKE @like OR delivery_country LIKE @like OR CAST(id AS TEXT) LIKE @like) AND (@status='' OR status=@status) ORDER BY CASE status WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'quoted' THEN 3 WHEN 'completed' THEN 4 ELSE 5 END,created_at DESC LIMIT 250`).all({term:String(req.query.q||''),like:`%${String(req.query.q||'')}%`,status:String(req.query.quote_status||'')});
 const r=db.prepare(`SELECT id,customer_name,customer_email,rating,review_text,display_consent,status,created_at FROM reviews WHERE (@term='' OR customer_name LIKE @like OR customer_email LIKE @like OR review_text LIKE @like) ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'published' THEN 2 WHEN 'hidden' THEN 3 ELSE 4 END,created_at DESC LIMIT 250`).all({term:String(req.query.q||''),like:`%${String(req.query.q||'')}%`});
 const counts={q_new:db.prepare("SELECT COUNT(*) n FROM quotations WHERE status='new'").get().n,q_contacted:db.prepare("SELECT COUNT(*) n FROM quotations WHERE status='contacted'").get().n,q_quoted:db.prepare("SELECT COUNT(*) n FROM quotations WHERE status='quoted'").get().n,r_pending:db.prepare("SELECT COUNT(*) n FROM reviews WHERE status='pending'").get().n,r_published:db.prepare("SELECT COUNT(*) n FROM reviews WHERE status='published'").get().n};
 const qa=db.prepare(`SELECT 'Quotation' section,a.action,a.detail,a.created_at,COALESCE('#'||q.id||' '||q.customer_name,'Deleted quotation') subject,ad.email FROM quotation_audit a LEFT JOIN quotations q ON q.id=a.quotation_id JOIN admins ad ON ad.id=a.admin_id ORDER BY a.created_at DESC LIMIT 40`).all();
 const ra=db.prepare(`SELECT 'Review' section,a.action,a.detail,a.created_at,COALESCE(r.customer_name,'Deleted review') subject,ad.email FROM review_audit a LEFT JOIN reviews r ON r.id=a.review_id JOIN admins ad ON ad.id=a.admin_id ORDER BY a.created_at DESC LIMIT 40`).all();
 res.json({quotations:q,reviews:r,counts,audit:[...qa,...ra].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,60)});
});
router.patch('/quotations/:id',requireAdmin,verifyCsrf,(req,res)=>{
 const id=Number(req.params.id), action=req.body.action;
 const row=db.prepare('SELECT id,status FROM quotations WHERE id=?').get(id);if(!row)return res.status(404).json({message:'Quotation not found.'});
 if(action==='status') {const status=String(req.body.status||'');if(!['new','contacted','quoted','completed','archived'].includes(status))return res.status(422).json({message:'Invalid status.'});db.prepare("UPDATE quotations SET status=?,updated_at=datetime('now') WHERE id=?").run(status,id);db.prepare('INSERT INTO quotation_audit(admin_id,quotation_id,action,detail) VALUES(?,?,?,?)').run(req.session.adminId,id,'status_change',`Status changed from ${row.status} to ${status}`);}
 else if(action==='delete'){db.prepare('INSERT INTO quotation_audit(admin_id,quotation_id,action,detail) VALUES(?,?,?,?)').run(req.session.adminId,id,'delete','Quotation permanently deleted by administrator');db.prepare('DELETE FROM quotations WHERE id=?').run(id);}
 else return res.status(400).json({message:'Invalid action.'});res.json({success:true});
});
router.patch('/reviews/:id',requireAdmin,verifyCsrf,(req,res)=>{
 const id=Number(req.params.id), action=req.body.action, row=db.prepare('SELECT id,display_consent,status FROM reviews WHERE id=?').get(id);if(!row)return res.status(404).json({message:'Review not found.'});
 if(action==='approve'){if(!row.display_consent)return res.status(403).json({message:'This customer did not consent to public display.'});db.prepare("UPDATE reviews SET status='published',updated_at=datetime('now') WHERE id=?").run(id);}
 else if(['hide','reject'].includes(action))db.prepare('UPDATE reviews SET status=?,updated_at=datetime(\'now\') WHERE id=?').run(action==='hide'?'hidden':'rejected',id);
 else if(action==='edit'){const name=String(req.body.customer_name||'').trim(),text=String(req.body.review_text||'').trim(),rating=Number(req.body.rating);if(!name||name.length>100||text.length<12||text.length>2000||!Number.isInteger(rating)||rating<1||rating>5)return res.status(422).json({message:'Invalid review edit.'});db.prepare("UPDATE reviews SET customer_name=?,review_text=?,rating=?,updated_at=datetime('now') WHERE id=?").run(name,text,rating,id);}
 else if(action==='delete'){db.prepare('INSERT INTO review_audit(admin_id,review_id,action,detail) VALUES(?,?,?,?)').run(req.session.adminId,id,'delete','Review permanently deleted by administrator');db.prepare('DELETE FROM reviews WHERE id=?').run(id);return res.json({success:true});}
 else return res.status(400).json({message:'Invalid action.'});
 db.prepare('INSERT INTO review_audit(admin_id,review_id,action,detail) VALUES(?,?,?,?)').run(req.session.adminId,id,action,`Review action: ${action}`);res.json({success:true});
});
router.get('/analytics',requireAdmin,(req,res)=>{
 try {
  const count = sql => db.prepare(sql).get().n;
  const stats = {
   totalViews: count("SELECT COUNT(*) n FROM analytics_events WHERE event_type='page_view'"),
   uniqueVisitors: count("SELECT COUNT(*) n FROM analytics_visitors"),
   totalSessions: count("SELECT COUNT(*) n FROM analytics_sessions"),
   visitorsToday: count("SELECT COUNT(*) n FROM analytics_visitors WHERE date(first_seen)=date('now','localtime')"),
   viewsToday: count("SELECT COUNT(*) n FROM analytics_events WHERE event_type='page_view' AND date(created_at,'localtime')=date('now','localtime')")
  };

  const days = [7,30,90,365].includes(Number(req.query.days))
    ? Number(req.query.days) : 7;
  const modifier = `-${days - 1} days`;

  const trend = db.prepare(`
   WITH RECURSIVE dates(day) AS (
    SELECT date('now','localtime',?)
    UNION ALL
    SELECT date(day,'+1 day') FROM dates
    WHERE day < date('now','localtime')
   )
   SELECT dates.day,
    COUNT(e.id) views,
    COUNT(DISTINCT e.visitor_id) visitors
   FROM dates
   LEFT JOIN analytics_events e
    ON date(e.created_at,'localtime')=dates.day
    AND e.event_type='page_view'
   GROUP BY dates.day
   ORDER BY dates.day
  `).all(modifier);

  const chartPages = db.prepare(`
   SELECT page_path,COUNT(*) views
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY page_path ORDER BY views DESC LIMIT 10
  `).all(modifier);

  const chartDevices = db.prepare(`
   SELECT device_type,COUNT(*) total
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY device_type ORDER BY total DESC
  `).all(modifier);

  const chartReferrals = db.prepare(`
   SELECT CASE WHEN referrer_domain=''
    THEN 'Direct' ELSE referrer_domain END source,
    COUNT(*) total
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY source ORDER BY total DESC LIMIT 10
  `).all(modifier);

  const pages = db.prepare("SELECT page_path,COUNT(*) views FROM analytics_events WHERE event_type='page_view' GROUP BY page_path ORDER BY views DESC LIMIT 10").all();
  const devices = db.prepare("SELECT device_type,COUNT(*) total FROM analytics_events WHERE event_type='page_view' GROUP BY device_type ORDER BY total DESC").all();
  const referrals = db.prepare("SELECT CASE WHEN referrer_domain='' THEN 'Direct' ELSE referrer_domain END source,COUNT(*) total FROM analytics_events WHERE event_type='page_view' GROUP BY source ORDER BY total DESC LIMIT 10").all();
  const recent = db.prepare("SELECT page_path,device_type,event_type,created_at FROM analytics_events ORDER BY id DESC LIMIT 20").all();

  res.json({
   success:true,stats,pages,devices,referrals,recent,
   charts:{trend,pages:chartPages,devices:chartDevices,referrals:chartReferrals}
  });
 } catch(err) {
  console.error('Admin analytics error:',err.message);
  res.status(500).json({success:false,message:'Could not load analytics.'});
 }
});
module.exports=router;

