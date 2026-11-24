require('dotenv').config();
const express=require('express');
const session=require('express-session');
const SQLiteSessionStore=require('./middleware/sqlite-session-store');
const helmet=require('helmet');
const path=require('node:path');
const fs=require('node:fs');
require('./config/database');
const app=express();
const PORT=Number(process.env.PORT||3000);
if(!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length<32){console.error('SESSION_SECRET is missing or shorter than 32 characters. Copy .env.example to .env and set a long random secret.');process.exit(1);}
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com","data:"],imgSrc:["'self'","data:","https:"],scriptSrc:["'self'"],connectSrc:["'self'"],upgradeInsecureRequests:null}}}));
app.use(express.urlencoded({extended:false,limit:'30kb'}));app.use(express.json({limit:'30kb'}));
fs.mkdirSync(path.join(__dirname,'data'),{recursive:true});
app.use(session({name:'uci.sid',store:new SQLiteSessionStore(),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}}));
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Ultimate Containers Inc. Node.js backend'}));
app.use('/api',require('./routes/public'));
app.use('/api',require('./routes/analytics'));
app.use('/api/admin',require('./routes/admin'));
app.get('/admin',(req,res)=>{
  if(req.path === '/admin') return res.redirect(301, '/admin/');
  res.sendFile(path.join(__dirname, 'admin-ui', 'index.html'));
});
app.use('/admin',express.static(path.join(__dirname,'admin-ui'),{index:'index.html'}));
app.use((req,res,next)=>{const blocked=['/config/','/scripts/','/routes/','/middleware/','/data/','/node_modules/'];const base=path.basename(req.path).toLowerCase();if(/\.(php|sql|env|md|zip|sqlite|db)$/i.test(req.path)||blocked.some(p=>req.path.startsWith(p))||['server.js','package.json','package-lock.json','.env.example','readme.md'].includes(base))return res.status(404).send('Not found');next();});
app.use(express.static(__dirname,{extensions:['html'],index:'index.html',dotfiles:'deny'}));
app.use((req,res)=>res.status(404).send('Page not found.'));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({success:false,message:'An unexpected server error occurred.'});});
app.listen(PORT,'0.0.0.0',()=>console.log(`Ultimate Containers Inc. is running at http://localhost:${PORT}`));


