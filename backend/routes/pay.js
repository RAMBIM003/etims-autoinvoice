const r=require('express').Router(),db=require('../db');
r.post('/c2b/validation',(q,s)=>s.json({ResultCode:0,ResultDesc:'Accepted'}));
r.post('/c2b/confirmation',async(q,s)=>{
 const b=q.body||{},t=String(b.TransTime||'');
 try{if(b.TransID){
  const ts=/^\d{14}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}T${t.slice(8,10)}:${t.slice(10,12)}:${t.slice(12,14)}+03:00`:null;
  await db.query('INSERT INTO mpesa_transactions(trans_id,merchant_id,business_shortcode,bill_ref_number,amount,trans_time,payer_ref,payer_name,raw_callback) VALUES($1,(SELECT merchant_id FROM mpesa_connections WHERE business_shortcode=$2::text LIMIT 1),$2::text,$3,$4,$5,$6,$7,$8) ON CONFLICT(trans_id) DO NOTHING',
   [b.TransID,String(b.BusinessShortCode||''),b.BillRefNumber||null,b.TransAmount,ts,b.MSISDN||null,[b.FirstName,b.MiddleName,b.LastName].filter(Boolean).join(' ')||null,b])}}
 catch(e){console.error('C2B store failed:',e.message)}
 s.json({ResultCode:0,ResultDesc:'Accepted'})});
module.exports=r;
