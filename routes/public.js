const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const { verifyCsrf } = require('../middleware/security');
const router = express.Router();
const quoteLimiter = rateLimit({ windowMs: 60*60*1000, limit: 5, standardHeaders: true, legacyHeaders: false, message:{success:false,message:'Too many quotation submissions. Please try again later.'} });
const reviewLimiter = rateLimit({ windowMs: 60*60*1000, limit: 3, standardHeaders: true, legacyHeaders: false, message:{success:false,message:'Too many review submissions. Please try again later.'} });
const clean = (v, max=2000) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max);
const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 180;
router.get('/csrf', (req,res)=>{ if(!req.session.csrfToken) req.session.csrfToken=require('node:crypto').randomBytes(32).toString('hex'); res.json({csrf_token:req.session.csrfToken}); });
router.post('/quotations', quoteLimiter, verifyCsrf, async (req,res)=>{
  if (clean(req.body.website,200)) return res.json({success:true,message:'Thank you. Your enquiry has been received.'});
const b=req.body;
const name=clean(b.full_name,120);
const email=clean(b.email,180);
const phone=clean(b.telephone,30);
const type=clean(b.container_type,80);
const qty=Number(b.quantity);
const city=clean(b.delivery_city,100);
const country=clean(b.delivery_country,100);
  if(!name || !emailOk(email) || !type || !Number.isInteger(qty) || qty<1 || qty>9999 || !city || !country || b.privacy_consent!=='1') return res.status(422).json({success:false,message:'Please complete all required fields and accept the privacy notice.'});
  const info={name,email,phone,type,size:clean(b.preferred_size,60),qty,condition:clean(b.condition,40),city,country,timeframe:clean(b.timeframe,80),details:clean(b.additional_info,2000)};
  try {
    const result = db.prepare(`
  INSERT INTO quotations (
    customer_name,
    customer_email,
    customer_phone,
    container_type,
    preferred_size,
    quantity,
    condition_preference,
    delivery_city,
    delivery_country,
    timeframe,
    additional_info,
    privacy_consent
  )
  VALUES (
    @name,
    @email,
    @phone,
    @type,
    @size,
    @qty,
    @condition,
    @city,
    @country,
    @timeframe,
    @details,
    1
  )
`).run(info);
    let notified=false;
    if(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.MAIL_TO){
      const port=Number(process.env.SMTP_PORT||587); const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:String(process.env.SMTP_SECURE)==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
      try { await transporter.sendMail({from:process.env.MAIL_FROM,to:process.env.MAIL_TO,replyTo:email,subject:`New website quotation #${result.lastInsertRowid}`,text:`New quotation received\n\nName: ${name}\nEmail: ${email}\nType: ${type}\nSize: ${info.size||'Not specified'}\nQuantity: ${qty}\nCondition: ${info.condition||'Not specified'}\nDelivery: ${city}, ${country}\nTimeframe: ${info.timeframe||'Not specified'}\nDetails: ${info.details||'None'}\n\nView it in the admin dashboard.`}); notified=true; } catch(e) { console.error('SMTP notification failed:',e.message); }
    }
    req.session.csrfToken = require('node:crypto').randomBytes(32).toString('hex');
    return res.status(201).json({success:true,message:`Thank you. Your quotation enquiry #${result.lastInsertRowid} has been saved${notified?' and our team has been notified by email':'. Email notification is not configured or could not be delivered; the enquiry is safely available in the admin dashboard'}.`});
  } catch(e){console.error('Quotation save failed:',e);return res.status(503).json({success:false,message:'We could not save your enquiry right now. Please try again later.'});}
});
router.get('/reviews', (req,res)=>{
 const rows=db.prepare("SELECT customer_name,rating,review_text,strftime('%Y-%m-%d',created_at) AS display_date FROM reviews WHERE status='published' AND display_consent=1 ORDER BY created_at DESC LIMIT 100").all();
 res.json({reviews:rows});
});
router.post('/reviews', reviewLimiter, verifyCsrf, (req,res)=>{
 if(clean(req.body.website,200)) return res.status(201).json({success:true,message:'Thank you for your feedback.'});
 const b=req.body, name=clean(b.customer_name,100), email=clean(b.customer_email,180), rating=Number(b.rating), body=clean(b.review_text,2000);
 if(!name || !emailOk(email) || !Number.isInteger(rating) || rating<1 || rating>5 || body.length<12 || b.processing_consent!=='1') return res.status(422).json({success:false,message:'Please provide a valid name, email, rating and review, and accept the privacy notice.'});
 try{db.prepare(`INSERT INTO reviews(customer_name,customer_email,rating,review_text,processing_consent,processing_consent_at,display_consent,status) VALUES(?,?,?,?,1,datetime('now'),?,'pending')`).run(name,email,rating,body,b.display_consent==='1'?1:0);req.session.csrfToken=require('node:crypto').randomBytes(32).toString('hex');res.status(201).json({success:true,message:'Thank you. Your review has been received and will remain private until it is moderated.'});}
 catch(e){console.error('Review save failed:',e);res.status(503).json({success:false,message:'We could not receive your review right now. Please try again later.'});}
});
module.exports=router;


