require('dotenv').config();
const C=require('../services/cryptoService');
const db=require('../db');
(async()=>{
 const r=await db.query("SELECT p.phone_encrypted,p.status FROM users u JOIN buyers b ON b.user_id=u.id JOIN buyer_phones p ON p.buyer_id=b.id WHERE u.email=$1",['rambimrodney@gmail.com']);
 if(!r.rows.length) console.log('no phone registered for this buyer');
 r.rows.forEach(x=>console.log(C.mask(C.dec(x.phone_encrypted)), x.status));
 process.exit(0);
})();
