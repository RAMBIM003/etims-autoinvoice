
const r=require('express').Router(),bcrypt=require('bcryptjs'),db=require('../db'),C=require('../services/cryptoService'),otp=require('../services/otpService'),kra=require('../services/kraService'),oscu=require('../services/oscuService'),mpesa=require('../services/mpesaService'),auth=require('../middleware/auth'),wrap=require('../middleware/wrap');

const need=(c,m)=>{if(!c)throw Object.assign(new Error(m),{status:400})};

r.post('/merchant/register',wrap(async(q,s)=>{

 const b=q.body||{};
 const trading=String(typeof b.business==='string'?b.business:(b.business&&b.business.tradingName)||'').trim();
 const email=String(b.email||'').trim().toLowerCase();
 const phone=String(b.phone||'').trim();

 need(String(b.fullName||'').trim().length>1,"Enter the owner's full name");
 need(C.phoneOk(phone),'Enter a valid phone number');
 need(/^\S+@\S+\.\S+$/.test(email),'Enter a valid email address');
 need(String(b.password||'').length>=8,'Password must be at least 8 characters');
 need(b.consent===true,'Consent is required');
 need(trading.length>0,'Enter the business name');

 /*
  * Sign-up only creates the owner's login and the business name. The KRA PIN,
  * branch and M-Pesa shortcode are connected in onboarding, where the merchant
  * row is created. The phone OTP is checked here, as before.
  */
 const out=await db.tx(async c=>{

   await otp.consume(c,phone,'SIGNUP_MERCHANT');

   const u=(await c.query(
     'INSERT INTO users(email,full_name,password_hash,phone_hash,phone_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id',
     [
       email,
       String(b.fullName).trim(),
       await bcrypt.hash(b.password,10),
       C.phoneHash(phone),
       C.enc(C.norm(phone))
     ]
   )).rows[0];

   await c.query(
     'INSERT INTO pending_businesses(user_id,trading_name,business_phone) VALUES($1,$2,$3)',
     [u.id,trading,C.norm(phone)]
   );

   await c.query(
     "INSERT INTO consent_records(user_id,subject_type,subject_id,purpose,policy_version,action) VALUES($1,'USER',$1,'ACCOUNT_TERMS','v1','GRANTED')",
     [u.id]
   );

   return{uid:u.id};
 });

 s.json({token:auth.sign(out.uid)});

}));

module.exports=r;
