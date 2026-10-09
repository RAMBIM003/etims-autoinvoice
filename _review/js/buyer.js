const r=require('express').Router();
const kra=require('../services/kraService'),otp=require('../services/otpService');
const wrap=f=>(q,s)=>f(q,s).catch(e=>s.status(e.status||500).json({error:e.message}));
r.post(['/buyer/validate-pin','/kra/validate-pin'],wrap(async(q,s)=>{
 const pin=String(q.body.pin||'').trim().toUpperCase();
 if(!/^[AP]\d{9}[A-Z]$/.test(pin))return s.status(400).json({error:'Invalid PIN format'});
 const x=await kra.validatePin(pin);
 x.valid?s.json(x):s.status(400).json({error:'Invalid PIN'})}));
r.post('/otp/send',wrap(async(q,s)=>{
 if(!/^(\+?254|0)[17]\d{8}$/.test(String(q.body.phone||'').replace(/\s/g,'')))return s.status(400).json({error:'Invalid phone number'});
 await otp.send(q.body.phone);s.json({sent:true})}));
r.post('/otp/verify',wrap(async(q,s)=>{otp.verify(q.body.phone,q.body.code);s.json({verified:true})}));
module.exports=r;
