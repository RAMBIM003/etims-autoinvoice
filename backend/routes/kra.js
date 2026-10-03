const r=require('express').Router(),db=require('../db'),kra=require('../services/kraService'),oscu=require('../services/oscuService'),wrap=require('../middleware/wrap');
const fail=(m,s)=>Object.assign(new Error(m),{status:s});
const check=async p=>{
 const pin=String(p||'').trim().toUpperCase();
 if(!/^[AP]\d{9}[A-Z]$/.test(pin))throw fail('Invalid PIN format',400);
 const k=await kra.validatePin(pin);
 await db.query("INSERT INTO kra_pin_verifications(subject_type,kra_pin,result_code,result_message,taxpayer_name,taxpayer_type,pin_status,raw_response) VALUES('PRE_REGISTRATION',$1,$2,$3,$4,$5,$6,$7)",[pin,k.code,k.message,k.name||null,k.type||null,k.status||null,k.raw]);
 if(!k.valid)throw fail('This KRA PIN is not valid',400);
 return k};
r.post('/kra/validate-pin',wrap(async(q,s)=>{const k=await check(q.body.pin);s.json({pin:k.pin,name:k.name,type:k.type,status:k.status})}));
r.post('/kra/connect',wrap(async(q,s)=>{
 const k=await check(q.body.pin);
 const o=k.status==='Active'?await oscu.check(k.pin):{connected:false,message:'The PIN is not active'};
 s.json({pin:k.pin,name:k.name,type:k.type,status:k.status,oscu:o})}));
module.exports=r;
