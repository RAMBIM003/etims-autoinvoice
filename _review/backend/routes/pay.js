const r=require('express').Router();
const db=require('../db');
const mpesa=require('../services/mpesaService');
const wrap=require('../middleware/wrap');

const fail=(m,s)=>Object.assign(new Error(m),{status:s});

r.post('/c2b/validation',(q,s)=>{
 s.json({ResultCode:0,ResultDesc:'Accepted'});
});

r.post('/c2b/confirmation',wrap(async(q,s)=>{
 const b=q.body||{};
 const transId=String(b.TransID||'').trim();
 const shortcode=String(b.BusinessShortCode||'').trim();
 const billRef=String(b.BillRefNumber||'').trim();
 const amount=Number(b.TransAmount||0);

 if(!transId){
  return s.json({ResultCode:1,ResultDesc:'Missing transaction ID'});
 }

 const ts=String(b.TransTime||'');
 const transTime=/^\d{14}$/.test(ts)
  ? `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}+03:00`
  : null;

 await db.tx(async c=>{
  const existing=(await c.query(
   'SELECT id FROM mpesa_transactions WHERE trans_id=$1',
   [transId]
  )).rows[0];

  if(existing)return;

  const merchant=(await c.query(
   `SELECT merchant_id
    FROM mpesa_connections
    WHERE business_shortcode=$1
    AND status IN ('ACTIVE','PENDING')
    LIMIT 1`,
   [shortcode]
  )).rows[0];

  if(!merchant){
   throw fail('Unknown M-Pesa shortcode',400);
  }

  const raw=(await c.query(
   `INSERT INTO mpesa_transactions
    (trans_id,merchant_id,business_shortcode,bill_ref_number,amount,
     trans_time,payer_ref,payer_name,raw_callback)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id,merchant_id`,
   [
    transId,
    merchant.merchant_id,
    shortcode,
    billRef||null,
    amount,
    transTime,
    b.MSISDN||null,
    [b.FirstName,b.MiddleName,b.LastName].filter(Boolean).join(' ')||null,
    b
   ]
  )).rows[0];

  if(!billRef){
   await c.query(
    `INSERT INTO payments
     (merchant_id,mpesa_transaction_id,payment_method,amount,currency,status,match_method,payment_reference,paid_at)
     VALUES($1,$2,'MPESA_C2B',$3,'KES','UNMATCHED','NO_BILL_REF',$4,$5)`,
    [raw.merchant_id,raw.id,amount,transId,transTime]
   );
   return;
  }

  const sale=(await c.query(
   `SELECT id,total_amount
    FROM sales
    WHERE merchant_id=$1
    AND order_reference=$2
    AND status='AWAITING_PAYMENT'
    LIMIT 1
    FOR UPDATE`,
   [raw.merchant_id,billRef]
  )).rows[0];

  if(!sale){
   await c.query(
    `INSERT INTO payments
     (merchant_id,mpesa_transaction_id,payment_method,amount,currency,status,match_method,payment_reference,paid_at)
     VALUES($1,$2,'MPESA_C2B',$3,'KES','UNMATCHED','BILL_REF_NOT_FOUND',$4,$5)`,
    [raw.merchant_id,raw.id,amount,billRef,transTime]
   );
   return;
  }

  const expected=Number(sale.total_amount);
  const status=Math.abs(expected-amount)<0.01?'MATCHED':'AMOUNT_MISMATCH';
  const method=status==='MATCHED'?'BILL_REF_AND_AMOUNT':'BILL_REF_AMOUNT_MISMATCH';

  await c.query(
   `INSERT INTO payments
    (merchant_id,sale_id,mpesa_transaction_id,payment_method,amount,
     currency,status,match_method,payment_reference,paid_at)
    VALUES($1,$2,$3,'MPESA_C2B',$4,'KES',$5,$6,$7,$8)`,
   [raw.merchant_id,sale.id,raw.id,amount,status,method,billRef,transTime]
  );

  if(status==='MATCHED'){
   await c.query(
    `UPDATE sales
     SET status='CLOSED',updated_at=now()
     WHERE id=$1`,
    [sale.id]
   );
  }
 });

 s.json({ResultCode:0,ResultDesc:'Accepted'});
}));

r.post('/c2b/register',wrap(async(q,s)=>{
 const shortcode=String(q.body.shortcode||'').trim();

 if(!/^\d{5,7}$/.test(shortcode))
  throw fail('Invalid shortcode',400);

 const result=await mpesa.registerUrls(shortcode);

 if(!result.ok)
  throw fail(result.error||'Daraja registration failed',502);

 s.json(result);
}));

module.exports=r;
