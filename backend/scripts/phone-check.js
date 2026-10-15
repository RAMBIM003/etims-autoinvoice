require('dotenv').config();
const C=require('../services/cryptoService');
const db=require('../db');
(async()=>{
 for (const p of ['0768670493','0786920044']) {
  const h=C.phoneHash(p);
  const b=(await db.query('SELECT 1 FROM buyer_phones WHERE phone_hash=$1',[h])).rows.length;
  const u=(await db.query('SELECT 1 FROM users WHERE phone_hash=$1',[h])).rows.length;
  console.log(p,'buyer_phones:',b,'users:',u);
 }
 process.exit(0);
})();

