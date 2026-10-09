const r=require('express').Router();
const db=require('../db');
const auth=require('../middleware/auth');
const wrap=require('../middleware/wrap');

const fail=(m,s)=>Object.assign(new Error(m),{status:s});

r.use(auth);

const merchant=async userId=>{
 const x=(await db.query(
  "SELECT m.id FROM merchants m JOIN merchant_users mu ON mu.merchant_id=m.id WHERE mu.user_id=$1 AND mu.status='ACTIVE' LIMIT 1",
  [userId]
 )).rows[0];

 if(!x)throw fail('Merchant account not found',404);
 return x.id;
};

r.get('/sales',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const rows=(await db.query(
  `SELECT * FROM sales
   WHERE merchant_id=$1
   ORDER BY created_at DESC`,
  [mid]
 )).rows;

 s.json({sales:rows});
}));

r.get('/sales/:id',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const sale=(await db.query(
  'SELECT * FROM sales WHERE id=$1 AND merchant_id=$2',
  [q.params.id,mid]
 )).rows[0];

 if(!sale)throw fail('Sale not found',404);

 const items=(await db.query(
  `SELECT * FROM sale_items
   WHERE sale_id=$1
   ORDER BY line_number`,
  [sale.id]
 )).rows;

 const payments=(await db.query(
  `SELECT * FROM payments
   WHERE sale_id=$1
   ORDER BY created_at DESC`,
  [sale.id]
 )).rows;

 s.json({sale,items,payments});
}));

r.post('/sales',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);
 const b=q.body;

 const lines=Array.isArray(b.items)?b.items:[];

 if(!lines.length)throw fail('At least one item is required',400);

 const reference=String(
  b.orderReference||b.order_reference||`ORD-${Date.now()}`
 ).trim();

 const result=await db.tx(async c=>{
  let subtotal=0;
  let tax=0;
  let total=0;

  const prepared=[];

  for(let i=0;i<lines.length;i++){
   const x=lines[i];

   const item=(await c.query(
    `SELECT * FROM items
     WHERE id=$1 AND merchant_id=$2 AND status='ACTIVE'`,
    [x.itemId||x.item_id,mid]
   )).rows[0];

   if(!item)throw fail(`Item ${i+1} not found or inactive`,400);

   const qty=Number(x.quantity);
   if(!Number.isFinite(qty)||qty<=0)
    throw fail(`Invalid quantity for ${item.name}`,400);

   const unitPrice=x.unitPrice==null?Number(item.price):Number(x.unitPrice);
   const taxRate=x.taxRate==null?Number(item.tax_rate||0):Number(x.taxRate);

   const lineSubtotal=Number((qty*unitPrice).toFixed(2));
   const lineTax=Number((lineSubtotal*taxRate/100).toFixed(2));
   const lineTotal=Number((lineSubtotal+lineTax).toFixed(2));

   subtotal+=lineSubtotal;
   tax+=lineTax;
   total+=lineTotal;

   prepared.push({
    item,
    qty,
    unitPrice,
    taxRate,
    lineSubtotal,
    lineTax,
    lineTotal
   });
  }

  subtotal=Number(subtotal.toFixed(2));
  tax=Number(tax.toFixed(2));
  total=Number(total.toFixed(2));

  const sale=(await c.query(
   `INSERT INTO sales
    (merchant_id,buyer_id,order_reference,status,currency,subtotal,tax_amount,total_amount,notes)
    VALUES($1,$2,$3,'AWAITING_PAYMENT',$4,$5,$6,$7,$8)
    RETURNING *`,
   [
    mid,
    b.buyerId||b.buyer_id||null,
    reference,
    b.currency||'KES',
    subtotal,
    tax,
    total,
    b.notes||null
   ]
  )).rows[0];

  for(let i=0;i<prepared.length;i++){
   const x=prepared[i];

   await c.query(
    `INSERT INTO sale_items
     (sale_id,item_id,line_number,sku,name,quantity,unit_price,
      tax_rate,tax_amount,line_subtotal,line_total,currency)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
     sale.id,
     x.item.id,
     i+1,
     x.item.sku,
     x.item.name,
     x.qty,
     x.unitPrice,
     x.taxRate,
     x.lineTax,
     x.lineSubtotal,
     x.lineTotal,
     b.currency||'KES'
    ]
   );
  }

  return sale;
 });

 s.status(201).json({
  sale:result,
  paymentReference:result.order_reference
 });
}));

r.post('/sales/:id/cancel',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const sale=(await db.query(
  `UPDATE sales
   SET status='CANCELLED',cancelled_at=now(),updated_at=now()
   WHERE id=$1 AND merchant_id=$2
   AND status IN ('DRAFT','AWAITING_PAYMENT')
   RETURNING *`,
  [q.params.id,mid]
 )).rows[0];

 if(!sale)throw fail('Sale cannot be cancelled',400);

 s.json({sale});
}));

module.exports=r;
