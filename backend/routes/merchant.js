const r=require('express').Router(),bcrypt=require('bcryptjs'),db=require('../db'),C=require('../services/cryptoService'),otp=require('../services/otpService'),kra=require('../services/kraService'),oscu=require('../services/oscuService'),mpesa=require('../services/mpesaService'),auth=require('../middleware/auth'),wrap=require('../middleware/wrap');
const need=(c,m)=>{if(!c)throw Object.assign(new Error(m),{status:400})};
r.post('/merchant/register',wrap(async(q,s)=>{
 const b=q.body,z=b.business||{},pin=String(z.pin||'').trim().toUpperCase(),email=String(b.email||'').trim().toLowerCase();
 need(String(b.fullName||'').trim().length>1,"Enter the owner's full name");
 need(C.phoneOk(b.phone),'Enter a valid owner phone number');
 need(/^\S+@\S+\.\S+$/.test(email),'Enter a valid email address');
 need(String(b.password||'').length>=8,'Password must be at least 8 characters');
 need(b.consent===true,'Consent is required');
 need(String(z.tradingName||'').trim(),'Enter the business name');
 need(C.phoneOk(z.phone),'Enter a valid business phone number');
 need(z.type,'Select the business type');
 need(/^\d{5,7}$/.test(z.paybill||'')||/^\d{5,7}$/.test(z.till||''),'Enter a Paybill or Till number');
 need(/^[AP]\d{9}[A-Z]$/.test(pin),'Invalid KRA PIN');
 const k=await kra.validatePin(pin);
 need(k.valid&&k.status==='Active','The KRA PIN is not valid and active');
 const o=await oscu.check(pin),bhf=process.env.KRA_BRANCH_ID||'00';
 const out=await db.tx(async c=>{
  await otp.consume(c,b.phone,'SIGNUP_MERCHANT');
  const u=(await c.query('INSERT INTO users(email,full_name,password_hash,phone_hash,phone_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id',[email,b.fullName.trim(),await bcrypt.hash(b.password,10),C.phoneHash(b.phone),C.enc(C.norm(b.phone))])).rows[0];
  const m=(await c.query('INSERT INTO merchants(trading_name,kra_pin,taxpayer_name,taxpayer_type,kra_status,business_phone,business_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[z.tradingName.trim(),pin,k.name,k.type,k.status,C.norm(z.phone),z.type])).rows[0];
  await c.query("INSERT INTO merchant_users(merchant_id,user_id,role) VALUES($1,$2,'OWNER')",[m.id,u.id]);
  const br=(await c.query("INSERT INTO merchant_branches(merchant_id,branch_code,branch_name,kra_bhf_id,is_head_office) VALUES($1,'HQ','Head office',$2,true) RETURNING id",[m.id,bhf])).rows[0];
  await c.query("INSERT INTO merchant_onboarding(merchant_id,current_step,status) VALUES($1,'ITEMS','IN_PROGRESS')",[m.id]);
  await c.query('INSERT INTO kra_connections(merchant_id,branch_id,environment,kra_pin,bhf_id,status,last_verified_at,last_result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[m.id,br.id,process.env.KRA_ENV||'SANDBOX',pin,bhf,o.connected?'CONNECTED':'NOT_CONNECTED',o.connected?new Date():null,o.message]);
  for(const[t,code]of[['PAYBILL',z.paybill],['TILL',z.till]])if(code)await c.query('INSERT INTO mpesa_connections(merchant_id,connection_type,environment,business_shortcode) VALUES($1,$2,$3,$4)',[m.id,t,process.env.MPESA_ENV||'sandbox',code]);
  await c.query("INSERT INTO kra_pin_verifications(subject_type,subject_id,kra_pin,result_code,result_message,taxpayer_name,taxpayer_type,pin_status,raw_response) VALUES('MERCHANT',$1,$2,$3,$4,$5,$6,$7,$8)",[m.id,pin,k.code,k.message,k.name,k.type,k.status,k.raw]);
  await c.query("INSERT INTO consent_records(user_id,subject_type,subject_id,purpose,policy_version,action) VALUES($1,'MERCHANT',$2,'ACCOUNT_TERMS','v1','GRANTED')",[u.id,m.id]);
  return{uid:u.id,mid:m.id}});
 // Best effort: a failed Daraja registration never blocks the account; the status shows on the dashboard
 for(const{business_shortcode:sc}of(await db.query('SELECT business_shortcode FROM mpesa_connections WHERE merchant_id=$1',[out.mid])).rows){
  const g=await mpesa.registerUrls(sc);
  await db.query("UPDATE mpesa_connections SET callback_registration_status=$1,callback_error=$2,callback_registered_at=$3,status=$4,updated_at=now() WHERE business_shortcode=$5",[g.ok?'REGISTERED':'FAILED',g.ok?null:g.error,g.ok?new Date():null,g.ok?'ACTIVE':'PENDING',sc])}
 s.json({token:auth.sign(out.uid)})}));
module.exports=r;
