// Fills the local test merchant (see seed-test-merchant.js) with items, buyers, sales, payments, invoices and receipts.
// Usage: node scripts/seed-test-data.js   (skips if the merchant already has sales)
require('dotenv').config({path:require('path').join(__dirname,'..','.env')});
const bcrypt=require('bcryptjs'),db=require('../db'),C=require('../services/cryptoService'),R=require('../services/receiptService');

const MERCHANT_EMAIL='merchant@test.local';
const RATE={A:0,B:16,C:0,D:0,E:8}; // KRA tax types: A exempt, B 16%, C zero-rated, D non-VAT, E 8%
const ITEMS=[
  ['SKU-001','Unga wa Ngano 2kg','PCS',215,'B'],['SKU-002','Cooking Oil 1L','PCS',380,'B'],
  ['SKU-003','Sugar 1kg','KG',185,'E'],['SKU-004','Fresh Milk 500ml','PCS',65,'A'],
  ['SKU-005','Maize Flour 2kg','PCS',190,'C'],['SKU-006','Bar Soap 800g','PCS',240,'B'],
  ['SKU-007','Bread 400g','PCS',70,'A'],['SKU-008','Delivery Charge','PCS',150,'D'],
];
const BUYERS=[
  {email:'buyer1@test.local',name:'Jane Wanjiku',phone:'0722000001',pin:'A012345678B'},
  {email:'buyer2@test.local',name:'Otieno Logistics Ltd',phone:'0722000002',pin:'P052222222Q'},
];
// [days ago, hour, buyer index or null, [[item index, qty]...], outcome]
// outcome: CLOSED (paid + fiscalized), PENDING / FAILED (paid, invoice not fiscalized), AWAITING, MISMATCH (underpaid), CANCELLED, DRAFT
const SALES=[
  [13,10,null,[[0,2],[1,1]],'CLOSED'],[12,15,0,[[2,3],[3,4]],'CLOSED'],[11,9,1,[[5,10],[7,1]],'CLOSED'],
  [9,13,null,[[6,2]],'CANCELLED'],[8,11,0,[[0,1],[4,2],[6,1]],'CLOSED'],[6,16,null,[[1,2]],'CLOSED'],
  [5,12,1,[[5,24],[1,6],[7,1]],'CLOSED'],[3,10,null,[[3,6],[6,2]],'CLOSED'],[2,14,0,[[2,2]],'FAILED'],
  [1,9,null,[[0,3],[2,1]],'CLOSED'],[1,17,1,[[4,10]],'MISMATCH'],
  [0,0,null,[[1,1],[3,2]],'CLOSED'],[0,0,0,[[0,1],[5,2]],'PENDING'],[0,0,null,[[6,3]],'AWAITING'],[0,0,null,[[2,1]],'DRAFT'],
];

const at=(daysAgo,hour,min=0)=>{const d=new Date();d.setDate(d.getDate()-daysAgo);
  if(daysAgo===0){d.setMinutes(d.getMinutes()-((hour+1)*37+min));return d} // today: spread over the past few hours
  d.setHours(hour,min,0,0);return d};
const plus=(d,min)=>new Date(d.getTime()+min*60000);
const money=n=>Number(n.toFixed(2));
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const transId=()=>Array.from({length:10},(_,i)=>'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'[Math.floor(rnd()*(i<3?24:34))]).join('');

(async()=>{
  const m=(await db.query(`SELECT m.* FROM merchants m JOIN merchant_users mu ON mu.merchant_id=m.id JOIN users u ON u.id=mu.user_id WHERE u.email=$1`,[MERCHANT_EMAIL])).rows[0];
  if(!m){console.error(`No merchant for ${MERCHANT_EMAIL}. Run scripts/seed-test-merchant.js first.`);process.exit(1)}
  if((await db.query('SELECT 1 FROM sales WHERE merchant_id=$1 LIMIT 1',[m.id])).rows.length){console.log('Test merchant already has sales; nothing added.');process.exit(0)}
  const branch=(await db.query('SELECT id FROM merchant_branches WHERE merchant_id=$1 AND is_head_office LIMIT 1',[m.id])).rows[0];
  const mpesa=(await db.query('SELECT business_shortcode FROM mpesa_connections WHERE merchant_id=$1 LIMIT 1',[m.id])).rows[0];
  const shortcode=mpesa?.business_shortcode||'123456',cuSerial=process.env.KRA_DEVICE_SERIAL||'KRACU0100000001';
  const fiscalized=[],counts={items:0,buyers:0,sales:0,payments:0,invoices:0};

  await db.tx(async c=>{
    const items=[];
    for(const [i,[sku,name,unit,price,tax]] of ITEMS.entries()){
      const it=(await c.query(`INSERT INTO items(merchant_id,sku,name,unit_code,unit_price,tax_type_code,tax_rate) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [m.id,sku,name,unit,price,tax,RATE[tax]])).rows[0];
      if(i<6)await c.query(`INSERT INTO item_kra_mappings(item_id,item_cls_code,item_code,item_name,tax_type_code,unit_code) VALUES($1,$2,$3,$4,$5,$6)`,
        [it.id,'5020230500',`KE2NT${unit==='KG'?'KG':'U'}${String(i+1).padStart(7,'0')}`,name,tax,unit]);
      items.push(it);counts.items++;
    }
    const buyers=[];
    for(const b of BUYERS){
      if((await c.query('SELECT 1 FROM users WHERE email=$1',[b.email])).rows.length){console.log('Buyer already exists, skipping:',b.email);buyers.push(null);continue}
      const u=(await c.query('INSERT INTO users(email,full_name,password_hash) VALUES($1,$2,$3) RETURNING id',[b.email,b.name,await bcrypt.hash('Test@1234',10)])).rows[0];
      const by=(await c.query(`INSERT INTO buyers(user_id,kra_pin,kra_taxpayer_name,kra_taxpayer_type,kra_pin_status,consent_at) VALUES($1,$2,$3,$4,'ACTIVE',now()) RETURNING id`,
        [u.id,b.pin,b.name.toUpperCase(),b.pin.startsWith('P')?'NON_INDIVIDUAL':'INDIVIDUAL'])).rows[0];
      await c.query('INSERT INTO buyer_phones(buyer_id,phone_hash,phone_encrypted,verified_at) VALUES($1,$2,$3,now())',[by.id,C.phoneHash(b.phone),C.enc(C.norm(b.phone))]);
      buyers.push({...b,id:by.id});counts.buyers++;
    }

    let invNo=0;
    for(const [n,[days,hour,bi,lines,outcome]] of SALES.entries()){
      const created=at(days,hour,(n*13)%50),buyer=bi==null?null:buyers[bi];
      const rows=lines.map(([ii,qty],k)=>{const it=items[ii],sub=money(qty*it.unit_price),tax=money(sub*RATE[it.tax_type_code]/100);
        return {it,qty,k:k+1,sub,tax,total:money(sub+tax)}});
      const subtotal=money(rows.reduce((a,r)=>a+r.sub,0)),taxAmt=money(rows.reduce((a,r)=>a+r.tax,0)),total=money(subtotal+taxAmt);
      const status={CLOSED:'CLOSED',PENDING:'FISCALIZATION_PENDING',FAILED:'FISCALIZATION_PENDING',AWAITING:'AWAITING_PAYMENT',MISMATCH:'AWAITING_PAYMENT',CANCELLED:'CANCELLED',DRAFT:'DRAFT'}[outcome];
      const ref=`ORD-${created.getTime()}`;
      const sale=(await c.query(`INSERT INTO sales(merchant_id,buyer_id,order_reference,status,subtotal,tax_amount,total_amount,created_at,updated_at,cancelled_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) RETURNING id`,[m.id,buyer?.id||null,ref,status,subtotal,taxAmt,total,created,outcome==='CANCELLED'?plus(created,20):null])).rows[0];
      for(const r of rows)await c.query(`INSERT INTO sale_items(sale_id,item_id,line_number,sku,item_name,quantity,unit_code,unit_price,tax_type_code,tax_rate,tax_amount,line_subtotal,line_total,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[sale.id,r.it.id,r.k,r.it.sku,r.it.name,r.qty,r.it.unit_code,r.it.unit_price,r.it.tax_type_code,r.it.tax_rate,r.tax,r.sub,r.total,created]);
      counts.sales++;
      if(['AWAITING','CANCELLED','DRAFT'].includes(outcome))continue;

      const paid=plus(created,3+n%7),amount=outcome==='MISMATCH'?money(total-100):total,tid=transId();
      const mt=(await c.query(`INSERT INTO mpesa_transactions(trans_id,merchant_id,business_shortcode,bill_ref_number,amount,trans_time,payer_ref,payer_name,raw_callback,callback_received_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$6) RETURNING id`,[tid,m.id,shortcode,ref,amount,paid,'2547*****'+String(100+n).slice(-3),buyer?.name.split(' ')[0].toUpperCase()||['JOHN','MARY','PETER','GRACE'][n%4],{seeded:true}])).rows[0];
      await c.query(`INSERT INTO payments(merchant_id,sale_id,mpesa_transaction_id,amount,status,match_method,payment_reference,paid_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$8)`,[m.id,sale.id,mt.id,amount,outcome==='MISMATCH'?'AMOUNT_MISMATCH':'MATCHED',outcome==='MISMATCH'?'BILL_REF_AMOUNT_MISMATCH':'BILL_REF_AND_AMOUNT',tid,paid]);
      counts.payments++;
      if(outcome==='MISMATCH')continue;

      invNo++;const issued=plus(paid,1),number=`INV-${issued.getFullYear()}-${String(invNo).padStart(6,'0')}`,ok=outcome==='CLOSED';
      const inv=(await c.query(`INSERT INTO invoices(merchant_id,sale_id,branch_id,invoice_number,seller_pin,seller_name,buyer_id,buyer_pin,buyer_name,subtotal,tax_amount,total_amount,
          fiscalization_status,kra_receipt_number,kra_invoice_number,cu_serial_number,sdc_date_time,fiscalized_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19) RETURNING id`,
        [m.id,sale.id,branch?.id||null,number,m.kra_pin,m.taxpayer_name||m.trading_name,buyer?.id||null,buyer?.pin||null,buyer?.name||null,subtotal,taxAmt,total,
         {CLOSED:'FISCALIZED',PENDING:'PENDING',FAILED:'FAILED'}[outcome],ok?String(1000+invNo):null,ok?String(invNo):null,ok?cuSerial:null,
         ok?issued.toISOString().replace(/\D/g,'').slice(0,14):null,ok?plus(issued,1):null,issued])).rows[0];
      if(outcome!=='PENDING')await c.query(`INSERT INTO fiscalization_attempts(invoice_id,attempt_number,status,http_status,kra_result_code,kra_result_message,error_message,started_at,completed_at)
        VALUES($1,1,$2,$3,$4,$5,$6,$7,$8)`,[inv.id,ok?'SUCCESS':'FAILED',ok?200:200,ok?'000':'910',ok?'It is succeeded':'Request parameter error',ok?null:'KRA rejected the invoice (seeded failure)',issued,plus(issued,1)]);
      if(ok)fiscalized.push(inv.id);
      counts.invoices++;
    }
    await c.query('INSERT INTO invoice_sequences(merchant_id,branch_id,next_number) VALUES($1,$2,$3)',[m.id,branch?.id||null,invNo+1]);

    // M-Pesa payments that arrived without a matching order
    for(const [days,amount,billRef,method] of [[4,500,null,'NO_BILL_REF'],[1,1250,'ORD-0000000000000','BILL_REF_NOT_FOUND'],[0,320,null,'NO_BILL_REF']]){
      const paid=at(days,11),tid=transId();
      const mt=(await c.query(`INSERT INTO mpesa_transactions(trans_id,merchant_id,business_shortcode,bill_ref_number,amount,trans_time,payer_ref,payer_name,raw_callback,callback_received_at)
        VALUES($1,$2,$3,$4,$5,$6,'2547*****999','UNKNOWN',$7,$6) RETURNING id`,[tid,m.id,shortcode,billRef,amount,paid,{seeded:true}])).rows[0];
      await c.query(`INSERT INTO payments(merchant_id,mpesa_transaction_id,amount,status,match_method,payment_reference,paid_at,created_at,updated_at) VALUES($1,$2,$3,'UNMATCHED',$4,$5,$6,$6,$6)`,
        [m.id,mt.id,amount,method,tid,paid]);
      counts.payments++;
    }
  });

  for(const id of fiscalized)await R.ensureReceipt(id);
  console.log(`Seeded ${MERCHANT_EMAIL}: ${counts.items} items, ${counts.buyers} buyers, ${counts.sales} sales, ${counts.payments} payments, ${counts.invoices} invoices, ${fiscalized.length} receipts.`);
  if(counts.buyers)console.log('Buyer logins: '+BUYERS.map(b=>b.email).join(', ')+' / Test@1234');
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
