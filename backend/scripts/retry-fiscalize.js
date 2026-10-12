require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const f = require('../services/fiscalizationService');
const db = require('../db');
(async () => {
  const s = (await db.query("SELECT id, order_reference FROM sales WHERE status = 'FISCALIZATION_PENDING' ORDER BY created_at DESC LIMIT 1")).rows[0];
  if (!s) { console.log('No pending sale'); process.exit(); }
  console.log('Submitting', s.order_reference);
  try { const out = await f.fiscalizeSale(s.id); console.log(JSON.stringify(out, null, 1).slice(0, 1500)); }
  catch (e) { console.log('FAILED:', e.message); }
  process.exit();
})();
