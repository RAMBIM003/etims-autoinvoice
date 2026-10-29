const r=require('express').Router(),bcrypt=require('bcryptjs'),db=require('../db'),C=require('../services/cryptoService'),otp=require('../services/otpService'),auth=require('../middleware/auth'),wrap=require('../middleware/wrap');
const fail=(m,s)=>Object.assign(new Error(m),{status:s});
const PURPOSES=['SIGNUP_MERCHANT','SIGNUP_BUYER','LOGIN'];
const byPhone=async h=>(await db.query("SELECT * FROM users WHERE phone_hash=$1 UNION SELECT u.* FROM users u JOIN buyers b ON b.user_id=u.id JOIN buyer_phones p ON p.buyer_id=b.id WHERE p.phone_hash=$1 AND p.status='ACTIVE' LIMIT 1",[h])).rows[0];
r.post('/otp/send',wrap(async(q,s)=>{
 const{phone,purpose}=q.body;
 if(!PURPOSES.includes(purpose))throw fail('Invalid request',400);
 if(!C.phoneOk(phone))throw fail('Invalid phone number',400);
 const u=await byPhone(C.phoneHash(phone));
 if(purpose!=='LOGIN'&&u)throw fail('This number already has an account. Sign in instead.',409);
 if(purpose==='LOGIN'&&!u)throw fail('No account found for this number. Sign in with your password or register as a buyer first.',404);
 await otp.send(phone,purpose);s.json({sent:true})}));
r.post('/otp/verify',wrap(async(q,s)=>{
 const{phone,code,purpose}=q.body;
 if(!PURPOSES.includes(purpose)||!C.phoneOk(phone))throw fail('Invalid request',400);
 await otp.verify(phone,code,purpose);s.json({verified:true})}));
// role tells the app which side to open: merchant first for a user who is both.
const roleOf=async id=>(await db.query("SELECT 1 FROM merchant_users WHERE user_id=$1 AND status='ACTIVE' LIMIT 1",[id])).rows.length?'MERCHANT':(await db.query('SELECT 1 FROM buyers WHERE user_id=$1',[id])).rows.length?'BUYER':null;
const login=async(u,s)=>{await db.query('UPDATE users SET last_login_at=now() WHERE id=$1',[u.id]);s.json({token:auth.sign(u.id),role:await roleOf(u.id)})};
r.post('/auth/login',wrap(async(q,s)=>{
 const id=String(q.body.identifier||'').trim().toLowerCase();
 const u=id.includes('@')?(await db.query('SELECT * FROM users WHERE email=$1',[id])).rows[0]:(C.phoneOk(id)?await byPhone(C.phoneHash(id)):null);
 if(!u||u.status!=='ACTIVE'||!(await bcrypt.compare(String(q.body.password||''),u.password_hash)))throw fail('Incorrect email/phone or password',401);
 await login(u,s)}));
r.post('/auth/login-otp',wrap(async(q,s)=>{
 const{phone,code}=q.body;
 if(!C.phoneOk(phone))throw fail('Invalid phone number',400);
 await otp.verify(phone,code,'LOGIN');
 const u=await byPhone(C.phoneHash(phone));
 if(!u||u.status!=='ACTIVE')throw fail('No account found for this number',404);
 await otp.consume(db.pool,phone,'LOGIN');await login(u,s)}));
r.get('/auth/me',auth,wrap(async(q,s)=>{
 const u=(await db.query('SELECT id,email,full_name,phone_encrypted FROM users WHERE id=$1',[q.user.sub])).rows[0];
 if(!u)throw fail('Please sign in',401);
 const out={user:{id:u.id,email:u.email,full_name:u.full_name,phone:u.phone_encrypted?C.mask(C.dec(u.phone_encrypted)):''}};
 const m=(await db.query("SELECT m.* FROM merchants m JOIN merchant_users mu ON mu.merchant_id=m.id WHERE mu.user_id=$1 AND mu.status='ACTIVE' LIMIT 1",[u.id])).rows[0];
 if(m){out.merchant=m;
  out.kra=(await db.query('SELECT status,last_verified_at,last_result FROM kra_connections WHERE merchant_id=$1',[m.id])).rows[0]||null;
  out.mpesa=(await db.query('SELECT connection_type AS type,business_shortcode AS shortcode,status,callback_registration_status AS callback FROM mpesa_connections WHERE merchant_id=$1',[m.id])).rows}
 const b=(await db.query('SELECT * FROM buyers WHERE user_id=$1',[u.id])).rows[0];
 if(b){out.buyer=b;out.phones=(await db.query("SELECT phone_encrypted FROM buyer_phones WHERE buyer_id=$1 AND status='ACTIVE'",[b.id])).rows.map(x=>C.mask(C.dec(x.phone_encrypted)))}
 s.json(out)}));
module.exports=r;

