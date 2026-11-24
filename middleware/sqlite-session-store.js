const session = require('express-session');
const db = require('../config/database');
class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);`);
    this.getStmt = db.prepare('SELECT sess, expires FROM sessions WHERE sid=?');
    this.setStmt = db.prepare('INSERT INTO sessions(sid,sess,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires=excluded.expires');
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid=?');
    this.touchStmt = db.prepare('UPDATE sessions SET expires=? WHERE sid=?');
  }
  get(sid, callback) {
    try { const row=this.getStmt.get(sid); if(!row)return callback(null,null); if(row.expires<=Date.now()){this.destroyStmt.run(sid);return callback(null,null);} callback(null,JSON.parse(row.sess)); }
    catch(err){callback(err);}
  }
  set(sid, sess, callback=()=>{}) {
    try { const expires=sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+(sess.cookie?.maxAge||86400000); this.setStmt.run(sid,JSON.stringify(sess),expires); callback(null); }
    catch(err){callback(err);}
  }
  touch(sid, sess, callback=()=>{}) {
    try { const expires=sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now()+(sess.cookie?.maxAge||86400000); this.touchStmt.run(expires,sid); callback(null); }
    catch(err){callback(err);}
  }
  destroy(sid, callback=()=>{}) { try {this.destroyStmt.run(sid);callback(null);}catch(err){callback(err);} }
}
module.exports=SQLiteSessionStore;
