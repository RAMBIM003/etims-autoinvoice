const crypto=require('crypto'),db=require('../db'),C=require('./cryptoService');
const TTL=()=>(+process.env.OTP_TTL_SECONDS||300)*1000;
const fail=(m,status)=>Object.assign(new Error(m),{status});
const h=(d,c,p)=>C.hmac(`otp:${p}:${d}:${c}`);
async function sms(to,text){
 if(process.env.SMS_PROVIDER!=='africastalking'){console.log(`\n[DEV SMS to ${to}] ${text}\n`);return}
 const sb=process.env.AT_USERNAME==='sandbox';
 const r=await fetch(`https://api${sb?'.sandbox':''}.africastalking.com/version1/messaging`,{method:'POST',
  headers:{apiKey:process.env.AT_API_KEY,Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({username:process.env.AT_USERNAME,to:'+'+to,message:text,...(process.env.AT_SENDER_ID&&{from:process.env.AT_SENDER_ID})})});
 if(!r.ok)throw fail('Could not send the SMS',502)}
async function send(phone,purpose){
 const d=C.phoneHash(phone);
 const last=(await db.query('SELECT created_at FROM otp_verifications WHERE destination_hash=$1 AND purpose=$2 ORDER BY created_at DESC LIMIT 1',[d,purpose])).rows[0];
 if(last&&Date.now()-last.created_at<30000)throw fail('Wait 30 seconds before requesting another code',429);
 const code=String(crypto.randomInt(100000,1000000));
 await db.query('INSERT INTO otp_verifications(destination_hash,purpose,otp_hash,expires_at) VALUES($1,$2,$3,$4)',[d,purpose,h(d,code,purpose),new Date(Date.now()+TTL())]);
 await sms(C.norm(phone),`Your eTIMS AutoInvoice code is ${code}. It expires in ${TTL()/60000} minutes.`)}
async function verify(phone,code,purpose){
 const d=C.phoneHash(phone);
 const o=(await db.query("SELECT * FROM otp_verifications WHERE destination_hash=$1 AND purpose=$2 AND status='PENDING' ORDER BY created_at DESC LIMIT 1",[d,purpose])).rows[0];
 if(!o||Date.now()>o.expires_at)throw fail('Code expired. Request a new one',400);
 if(o.attempt_count>=5){await db.query("UPDATE otp_verifications SET status='LOCKED' WHERE id=$1",[o.id]);throw fail('Too many attempts. Request a new code',429)}
 if(h(d,String(code),purpose)!==o.otp_hash){await db.query('UPDATE otp_verifications SET attempt_count=attempt_count+1 WHERE id=$1',[o.id]);throw fail('Wrong code',400)}
 await db.query("UPDATE otp_verifications SET status='VERIFIED',verified_at=now() WHERE id=$1",[o.id])}
// Used when the account is created: needs a verification from the last 30 minutes
async function consume(client,phone,purpose){
 const r=await client.query("UPDATE otp_verifications SET status='USED' WHERE id=(SELECT id FROM otp_verifications WHERE destination_hash=$1 AND purpose=$2 AND status='VERIFIED' AND verified_at>now()-interval '30 minutes' ORDER BY verified_at DESC LIMIT 1) RETURNING id",[C.phoneHash(phone),purpose]);
 if(!r.rowCount)throw fail('Verify your phone number with the OTP first',400)}
module.exports={send,verify,consume};
