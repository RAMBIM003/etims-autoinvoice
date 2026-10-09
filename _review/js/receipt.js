const id=new URLSearchParams(location.search).get('id'),el=document.getElementById('r');
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f=n=>'KSh '+Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2});
(async()=>{const r=id&&await API.get('/receipts/'+encodeURIComponent(id));
 if(!r)return el.innerHTML='<div class="empty"><b>Receipt not found</b>This link is invalid, or the receipt is not available yet.</div>';
 const s={FISCALIZED:['ok','Fiscalized'],PENDING:['','Pending'],FAILED:['bad','Action required']}[r.status]||['','Pending'];
 el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><h2>Fiscal receipt</h2><span class="pill ${s[0]}">${s[1]}</span></div>
 <h3 style="margin-top:14px">${esc(r.merchant)}</h3><p class="sub">KRA PIN ${esc(r.merchantPin)} · ${esc(r.date)}</p>
 <dl class="pf2" style="margin:16px 0"><dt>KRA receipt no.</dt><dd>${esc(r.kraReceiptNo||'Awaiting KRA')}</dd></dl>
 <table><thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead><tbody>${(r.items||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(i.qty)}</td><td>${f(i.total)}</td></tr>`).join('')}</tbody></table>
 <dl class="pf2" style="margin-top:16px"><dt>Taxable amount</dt><dd>${f(r.taxable)}</dd><dt>Tax</dt><dd>${f(r.tax)}</dd><dt>Total paid</dt><dd><b>${f(r.total)}</b></dd><dt>Payment method</dt><dd>M-Pesa</dd><dt>M-Pesa reference</dt><dd>${esc(r.mpesaRef)}</dd></dl>
 ${r.status==='FISCALIZED'?`<div class="note" style="background:#f5f6f8;padding:14px;border-radius:10px;margin-top:16px"><b>KRA verification</b><br>${r.qr?`<img src="${esc(r.qr)}" alt="KRA QR" width="120">`:''}<br><small>${esc(r.signature||'')}</small></div>`:''}
 <p style="margin-top:20px"><button class="btn btn-red" onclick="print()">Print</button></p>`})();
