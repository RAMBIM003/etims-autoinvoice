const r=require('express').Router(),bcrypt=require('bcryptjs'),db=require('../db'),C=require('../services/cryptoService'),otp=require('../services/otpService'),kra=require('../services/kraService'),auth=require('../middleware/auth'),wrap=require('../middleware/wrap');
const need=(c,m)=>{if(!c)throw Object.assign(new Error(m),{status:400})};
r.post('/buyer/register',wrap(async(q,s)=>{
 const b=q.body,pin=String(b.pin||'').trim().toUpperCase(),email=String(b.email||'').trim().toLowerCase()||null;
 need(C.phoneOk(b.phone),'Enter a valid mobile number');
 need(b.consent===true,'Consent is required');
 need(/^[AP]\d{9}[A-Z]$/.test(pin),'Invalid KRA PIN');
 need(!email||/^\S+@\S+\.\S+$/.test(email),'Enter a valid email address or leave it empty');
 need(String(b.password||'').length>=8,'Password must be at least 8 characters');
 const k=await kra.validatePin(pin);
 need(k.valid&&k.status==='Active','The KRA PIN is not valid and active');
 const uid=await db.tx(async c=>{
  await otp.consume(c,b.phone,'SIGNUP_BUYER');
  const ph=C.phoneHash(b.phone),pe=C.enc(C.norm(b.phone));
  const u=(await c.query('INSERT INTO users(email,full_name,password_hash,phone_hash,phone_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id',[email,k.name,await bcrypt.hash(b.password,10),ph,pe])).rows[0];
  const by=(await c.query('INSERT INTO buyers(user_id,kra_pin,kra_taxpayer_name,kra_taxpayer_type,kra_pin_status,consent_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING id',[u.id,pin,k.name,k.type,k.status])).rows[0];
  await c.query('INSERT INTO buyer_phones(buyer_id,phone_hash,phone_encrypted,verified_at) VALUES($1,$2,$3,now())',[by.id,ph,pe]);
  await c.query("INSERT INTO kra_pin_verifications(subject_type,subject_id,kra_pin,result_code,result_message,taxpayer_name,taxpayer_type,pin_status,raw_response) VALUES('BUYER',$1,$2,$3,$4,$5,$6,$7,$8)",[by.id,pin,k.code,k.message,k.name,k.type,k.status,k.raw]);
  await c.query("INSERT INTO consent_records(user_id,subject_type,subject_id,purpose,policy_version,action) VALUES($1,'BUYER',$2,'RECEIPT_DELIVERY','v1','GRANTED')",[u.id,by.id]);
  return u.id});
 s.json({token:auth.sign(uid)})}));
module.exports=r;
