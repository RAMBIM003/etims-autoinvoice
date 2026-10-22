const fs = require('fs');
const f = 'services/itemKraService.js';
fs.copyFileSync(f, f + '.bak');
let t = fs.readFileSync(f, 'utf8');
const edits = [
  ["const QTY_SLOT = { PCS: 'NO', NO: 'NO', KG: 'KG', BX: 'BX', PA: 'PA' };",
   "const QTY_SLOT = { PCS: 'NO', NO: 'NO', KG: 'KG', BX: 'BX', PA: 'PA', LTR: 'LTR', L: 'L' };"],
  ["const LITRE_UNITS = ['LTR', 'L'];",
   "const LITRE_UNITS = [];"],
  ["[A-Z]{4}[0-9]{7}$'",
   "[A-Z]{2,5}[0-9]{7}$'"]
];
const bad = edits.filter(([o]) => t.split(o).length - 1 !== 1).map(([o]) => o);
if (bad.length) { console.log('Abort, nothing changed. Not found exactly once:'); bad.forEach(x => console.log('  ' + x)); process.exit(1); }
for (const [o, n] of edits) t = t.split(o).join(n);
fs.writeFileSync(f, t);
console.log('itemKraService.js patched. Backup at services/itemKraService.js.bak');
