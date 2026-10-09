const r = require('express').Router();
const db = require('../db');
const kra = require('../services/kraService');
const oscu = require('../services/oscuService');
const wrap = require('../middleware/wrap');

const fail = (m,s) =>
  Object.assign(new Error(m),{status:s});

const check = async p => {
 const pin=String(p||'').trim().toUpperCase();

 if(!/^[AP]\d{9}[A-Z]$/.test(pin))
  throw fail('Invalid PIN format',400);

 const k=await kra.validatePin(pin);

 await db.query(
  `INSERT INTO kra_pin_verifications
   (subject_type,kra_pin,result_code,result_message,
    taxpayer_name,taxpayer_type,pin_status,raw_response)
   VALUES('PRE_REGISTRATION',$1,$2,$3,$4,$5,$6,$7)`,
  [pin,k.code,k.message,k.name||null,k.type||null,k.status||null,k.raw]
 );

 return k;
};

r.post('/kra/validate-pin',wrap(async(q,s)=>{
 const k=await check(q.body.pin);

 if(k.unavailable)
  return s.json({
   pin:q.body.pin,
   verified:false,
   status:'UNAVAILABLE',
   code:k.code,
   message:k.message
  });

 if(!k.valid)
  throw fail('This KRA PIN is not valid',400);

 s.json({
  pin:k.pin,
  name:k.name,
  type:k.type,
  status:k.status,
  verified:true
 });
}));

r.post('/kra/connect',wrap(async(q,s)=>{
 const pin=String(q.body.pin||'').trim().toUpperCase();

 if(!/^[AP]\d{9}[A-Z]$/.test(pin))
  throw fail('Invalid PIN format',400);

 const pinCheck=await check(pin);

 const sandboxUnavailable=
  pinCheck.unavailable &&
  pinCheck.code==='19005' &&
  String(process.env.KRA_ENV||'').toUpperCase()==='SANDBOX';

 if(!pinCheck.valid&&!sandboxUnavailable)
  throw fail('This KRA PIN is not valid',400);

 const o=await oscu.check(pin);

 s.json({
  pin,
  name:pinCheck.name||null,
  type:pinCheck.type||null,
  status:pinCheck.status||'UNVERIFIED',
  pinChecker:{
   verified:!!pinCheck.valid,
   status:pinCheck.unavailable?'UNAVAILABLE':'VERIFIED',
   code:pinCheck.code||null,
   message:pinCheck.message||null
  },
  oscu:o
 });
}));

r.post('/kra/fiscalize/:saleId',wrap(async(q,s)=>{
 const sale=(await db.query(
  `SELECT s.*,m.kra_pin,m.trading_name
   FROM sales s
   JOIN merchants m ON m.id=s.merchant_id
   WHERE s.id=$1`,
  [q.params.saleId]
 )).rows[0];

 if(!sale)throw fail('Sale not found',404);

 if(sale.status!=='CLOSED')
  throw fail('Sale must have a matched payment before fiscalization',400);

 const existing=(await db.query(
  `SELECT * FROM invoices
   WHERE sale_id=$1
   AND invoice_type='STANDARD'
   LIMIT 1`,
  [sale.id]
 )).rows[0];

 if(existing&&existing.fiscalization_status==='FISCALIZED')
  return s.json({invoice:existing});

 const branch=process.env.KRA_BRANCH_ID||'01';
 const serial=process.env.KRA_DEVICE_SERIAL||null;
 const cmcKey=process.env.KRA_CMC_KEY;

 if(!sale.kra_pin||!cmcKey)
  throw fail('KRA OSCU credentials are not configured',500);

 const items=(await db.query(
  `SELECT si.*,i.id AS catalogue_item_id,im.item_class_code
   FROM sale_items si
   LEFT JOIN items i ON i.id=si.item_id
   LEFT JOIN item_kra_mappings im ON im.item_id=i.id
   WHERE si.sale_id=$1
   ORDER BY si.line_number`,
  [sale.id]
 )).rows;

 if(!items.length)
  throw fail('Sale has no items',400);

 for(const x of items){
  if(!x.item_class_code)
   throw fail(`Item ${x.name} has no KRA item classification mapping`,400);
 }

 let invoice=existing;

 if(!invoice){
  const seq=(await db.query(
   `INSERT INTO invoice_sequences(merchant_id,branch_id,next_number)
    VALUES($1,NULL,2)
    ON CONFLICT(merchant_id,branch_id)
    DO UPDATE SET next_number=invoice_sequences.next_number+1,
                  updated_at=now()
    RETURNING next_number-1 AS invoice_number`,
   [sale.merchant_id]
  )).rows[0];

  invoice=(await db.query(
   `INSERT INTO invoices
    (merchant_id,sale_id,invoice_number,seller_pin,seller_name,
     currency,subtotal,tax_amount,total_amount,fiscalization_status,
     cu_serial_number)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'PROCESSING',$10)
    RETURNING *`,
   [
    sale.merchant_id,
    sale.id,
    `INV-${seq.invoice_number}`,
    sale.kra_pin,
    sale.trading_name,
    sale.currency,
    sale.subtotal,
    sale.tax_amount,
    sale.total_amount,
    serial
   ]
  )).rows[0];
 }else{
  invoice=(await db.query(
   `UPDATE invoices
    SET fiscalization_status='PROCESSING',updated_at=now()
    WHERE id=$1
    RETURNING *`,
   [invoice.id]
  )).rows[0];
 }

 const now=new Date();
 const cfm=now.toISOString()
  .replace(/[-:TZ.]/g,'')
  .slice(0,14);

 const payload={
  tin:sale.kra_pin,
  bhfId:branch,
  trdInvcNo:invoice.invoice_number,
  invcNo:Number(String(invoice.invoice_number).replace(/\D/g,''))||invoice.id,
  orgInvcNo:0,
  custTin:null,
  custNm:null,
  rcptTyCd:'S',
  pmtTyCd:'06',
  salesSttsCd:'02',
  cfmDt:cfm,
  salesDt:cfm.slice(0,8),
  stockRlsDt:null,
  cnclReqDt:null,
  cnclDt:null,
  rfdDt:null,
  rfdRsnCd:null,
  totItemCnt:items.length,
  taxblAmtA:0,
  taxblAmtB:0,
  taxblAmtC:0,
  taxblAmtD:0,
  taxblAmtE:0,
  taxAmtA:0,
  taxAmtB:0,
  taxAmtC:0,
  taxAmtD:0,
  taxAmtE:0,
  totTaxblAmt:Number(sale.subtotal),
  totTaxAmt:Number(sale.tax_amount),
  totAmt:Number(sale.total_amount),
  cashDcRt:0,
  cashDcAmt:0,
  remark:null,
  itemList:items.map((x,i)=>({
   itemSeq:i+1,
   itemCd:x.sku||`ITEM-${x.item_id}`,
   itemClsCd:x.item_class_code,
   itemNm:x.name,
   bcd:'',
   pkgUnitCd:'NT',
   pkg:1,
   qtyUnitCd:x.unit||'U',
   qty:Number(x.quantity),
   prc:Number(x.unit_price),
   splyAmt:Number(x.line_subtotal),
   dcRt:0,
   dcAmt:0,
   taxTyCd:x.tax_type_code||'B',
   taxblAmt:Number(x.line_subtotal),
   taxAmt:Number(x.tax_amount),
   totAmt:Number(x.line_total)
  }))
 };

 const attempt=(await db.query(
  `SELECT COALESCE(MAX(attempt_number),0)+1 AS n
   FROM fiscalization_attempts
   WHERE invoice_id=$1`,
  [invoice.id]
 )).rows[0].n;

 await db.query(
  `INSERT INTO fiscalization_attempts
   (invoice_id,attempt_number,status,request_reference,request_payload)
   VALUES($1,$2,'STARTED',$3,$4)`,
  [invoice.id,attempt,invoice.invoice_number,payload]
 );

 try{
  const response=await fetch(
   `${process.env.OSCU_BASE_URL||'https://etims-api-sbx.kra.go.ke/etims-api'}/saveTrnsSalesOsdc`,
   {
    method:'POST',
    headers:{
     'Content-Type':'application/json',
     tin:sale.kra_pin,
     bhfId:branch,
     cmcKey:cmcKey
    },
    body:JSON.stringify(payload)
   }
  );

  const body=await response.json().catch(()=>({}));
  const success=response.ok&&body.resultCd==='000';

  await db.query(
   `UPDATE fiscalization_attempts
    SET status=$1,response_payload=$2,http_status=$3,
        kra_result_code=$4,kra_result_message=$5,completed_at=now()
    WHERE invoice_id=$6 AND attempt_number=$7`,
   [
    success?'SUCCESS':'FAILED',
    body,
    response.status,
    body.resultCd||null,
    body.resultMsg||null,
    invoice.id,
    attempt
   ]
  );

  if(!success){
   await db.query(
    `UPDATE invoices
     SET fiscalization_status='FAILED',updated_at=now()
     WHERE id=$1`,
    [invoice.id]
   );

   throw fail(body.resultMsg||'KRA fiscalization failed',502);
  }

  const d=body.data||{};

  const finalInvoice=(await db.query(
   `UPDATE invoices
    SET fiscalization_status='FISCALIZED',
        kra_receipt_number=$1,
        kra_invoice_number=$2,
        kra_internal_data=$3,
        receipt_signature=$4,
        sdc_date_time=$5,
        fiscalized_at=now(),
        updated_at=now()
    WHERE id=$6
    RETURNING *`,
   [
    d.curRcptNo==null?null:String(d.curRcptNo),
    d.totRcptNo==null?null:String(d.totRcptNo),
    d.intrlData||null,
    d.rcptSign||null,
    d.sdcDateTime||null,
    invoice.id
   ]
  )).rows[0];

  s.json({invoice:finalInvoice,kra:body});
 }catch(e){
  if(e.status)throw e;

  await db.query(
   `UPDATE fiscalization_attempts
    SET status='TIMEOUT',error_message=$1,completed_at=now()
    WHERE invoice_id=$2 AND attempt_number=$3`,
   [e.message,invoice.id,attempt]
  );

  await db.query(
   `UPDATE invoices
    SET fiscalization_status='FAILED',updated_at=now()
    WHERE id=$1`,
   [invoice.id]
  );

  throw fail('Could not reach KRA eTIMS',502);
 }
}));

module.exports=r;
