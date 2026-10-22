const fs = require('fs');
const f = 'routes/sales.js';
fs.copyFileSync(f, f + '.bak');
let t = fs.readFileSync(f, 'utf8');
const old = 'const total = Number((subtotal + tax).toFixed(2));';
const neu = [
  'const exactTotal = Number((subtotal + tax).toFixed(2));',
  'const total = Math.round(exactTotal);',
  'tax = Number((tax + (total - exactTotal)).toFixed(2));'
].join('\n        ');
if (t.split(old).length - 1 !== 1) {
  console.log('Abort: anchor not found exactly once. Nothing changed.');
  process.exit(1);
}
fs.writeFileSync(f, t.split(old).join(neu));
console.log('sales.js patched. Backup at routes/sales.js.bak');
