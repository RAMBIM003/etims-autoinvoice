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

r.get('/items',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const rows=(await db.query(
  `SELECT * FROM items
   WHERE merchant_id=$1
   ORDER BY created_at DESC`,
  [mid]
 )).rows;

 s.json({items:rows});
}));

r.post('/items',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);
 const b=q.body;

 if(!String(b.name||'').trim())
  throw fail('Item name is required',400);

 if(Number(b.price)<0||!Number.isFinite(Number(b.price)))
  throw fail('Valid price is required',400);

 const item=(await db.query(
  `INSERT INTO items
   (merchant_id,sku,name,description,unit,price,currency,tax_type,tax_rate,status)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE')
   RETURNING *`,
  [
   mid,
   b.sku?String(b.sku).trim():null,
   String(b.name).trim(),
   b.description?String(b.description).trim():null,
   b.unit?String(b.unit).trim():'U',
   Number(b.price),
   b.currency||'KES',
   b.taxType||b.tax_type||null,
   b.taxRate==null?null:Number(b.taxRate)
  ]
 )).rows[0];

 s.status(201).json({item});
}));

r.get('/items/:id',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const item=(await db.query(
  'SELECT * FROM items WHERE id=$1 AND merchant_id=$2',
  [q.params.id,mid]
 )).rows[0];

 if(!item)throw fail('Item not found',404);

 s.json({item});
}));

r.put('/items/:id',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);
 const b=q.body;

 const item=(await db.query(
  `UPDATE items SET
    sku=COALESCE($1,sku),
    name=COALESCE($2,name),
    description=COALESCE($3,description),
    unit=COALESCE($4,unit),
    price=COALESCE($5,price),
    currency=COALESCE($6,currency),
    tax_type=COALESCE($7,tax_type),
    tax_rate=COALESCE($8,tax_rate),
    status=COALESCE($9,status),
    updated_at=now()
   WHERE id=$10 AND merchant_id=$11
   RETURNING *`,
  [
   b.sku??null,
   b.name??null,
   b.description??null,
   b.unit??null,
   b.price==null?null:Number(b.price),
   b.currency??null,
   b.taxType??b.tax_type??null,
   b.taxRate==null?null:Number(b.taxRate),
   b.status??null,
   q.params.id,
   mid
  ]
 )).rows[0];

 if(!item)throw fail('Item not found',404);

 s.json({item});
}));

r.delete('/items/:id',wrap(async(q,s)=>{
 const mid=await merchant(q.user.sub);

 const item=(await db.query(
  `UPDATE items SET status='INACTIVE',updated_at=now()
   WHERE id=$1 AND merchant_id=$2
   RETURNING id,status`,
  [q.params.id,mid]
 )).rows[0];

 if(!item)throw fail('Item not found',404);

 s.json({item});
}));

module.exports=r;
