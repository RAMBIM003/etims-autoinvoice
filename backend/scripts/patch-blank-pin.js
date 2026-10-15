const fs = require('fs');
const f = 'routes/buyer.js';
fs.copyFileSync(f, f + '.bak');
let t = fs.readFileSync(f, 'utf8');
const edits = [
  ["const pin = String(b.pin || '').trim().toUpperCase();",
   "const pin = String(b.pin || '').trim().toUpperCase() || null;"],
  ["!/^[AP]\\d{9}[A-Z]$/.test(pin) ||",
   "(pin !== null && !/^[AP]\\d{9}[A-Z]$/.test(pin)) ||"],
  ["let k = await kra.validatePin(pin);",
   "let k = pin ? await kra.validatePin(pin) : { valid: true, status: 'Active', name: String(b.name || '').trim() || 'Buyer', type: null, unavailable: false };"]
];
const bad = edits.filter(([old]) => t.split(old).length - 1 !== 1).map(([old]) => old);
if (bad.length) {
  console.log('Abort, nothing changed. Not found exactly once:');
  bad.forEach(x => console.log('  ' + x));
  process.exit(1);
}
for (const [old, neu] of edits) t = t.split(old).join(neu);
fs.writeFileSync(f, t);
console.log('buyer.js patched. Backup at routes/buyer.js.bak');
