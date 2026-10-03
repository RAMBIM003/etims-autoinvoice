const IC={dash:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',items:'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',orders:'M6 2L3 6v14h18V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',payments:'M2 6h20v12H2zM2 10h20',invoices:'M14 2H6v20h12V8zM14 2v6h6M9 13h6M9 17h6',customers:'M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8z',reports:'M4 20V10M10 20V4M16 20v-7M22 20H2',settings:'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12h2M3 12h2M12 3v2M12 19v2',receipts:'M14 2H6v20h12V8zM14 2v6h6M9 13h6M9 17h6',merchants:'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',profile:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',help:'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01'};
const $=s=>document.querySelector(s),role=document.body.dataset.role;
const me=await API.get('/auth/me');
if(!me||!me[role]){location.replace('log.html');throw new Error('redirect')}
const m=me.merchant||{},bu=me.buyer||{};
const ses=role==='merchant'?{name:me.user.full_name,phone:me.user.phone,email:me.user.email,business:m.trading_name,pin:m.kra_pin,kraName:m.taxpayer_name,type:m.taxpayer_type,status:m.kra_status,businessType:m.business_type,businessPhone:m.business_phone}:{name:bu.kra_taxpayer_name,phone:(me.phones||[])[0]||'',email:me.user.email,pin:bu.kra_pin,type:bu.kra_taxpayer_type,status:bu.kra_pin_status};
const mp=me.mpesa||[],kS=me.kra&&me.kra.status==='CONNECTED'?'Connected':'Not connected';
const mpS=mp.length?(mp.every(c=>c.callback==='REGISTERED')?'Connected':'Callbacks pending'):'Not connected';
const tc=t=>t.charAt(0)+t.slice(1).toLowerCase(),first=ses.type==='Individual'?tc(String(ses.name||'').split(' ')[0]):ses.name;
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const empty=(t,d,b)=>`<div class="empty"><b>${t}</b>${d}${b?`<br><br><button class="btn btn-red" data-soon>${b}</button>`:''}</div>`;
const table=(c,t,d,b,tool)=>`${tool||''}<div class="card2"><table><thead><tr>${c.map(x=>`<th>${x}</th>`).join('')}</tr></thead></table>${empty(t,d,b)}</div>`;
const kpi=(l,v)=>`<div class="kpi"><small>${l}</small><b>${v}</b></div>`;
const st=(l,v,ok)=>`<div class="row2"><span>${l}</span><span class="pill ${ok?'ok':''}">${v}</span></div>`;
const dl=a=>`<dl class="pf2">${a.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v||'Not provided')}</dd>`).join('')}</dl>`;
const search=p=>`<div class="tool"><input placeholder="${p}"></div>`;
const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2600)};
const M={
 dash:['Dashboard','Sales overview, connection status and alerts.',()=>`<div class="kpis">${kpi('Sales today','KSh 0.00')}${kpi('Payments received',0)}${kpi('Fiscal invoices',0)}${kpi('Unmatched payments',0)}</div>
 <div class="grid2"><div class="card2"><h3>Connection status</h3>${st('M-Pesa',mpS,mpS==='Connected')}${st('KRA eTIMS / OSCU',kS,kS==='Connected')}${st('Item catalogue','Not configured')}${st('Sales source','Not set')}</div>
 <div class="card2"><h3>Recent sales</h3>${empty('No sales yet','Create your first order to begin testing the payment and invoicing flow.','+ Create order')}</div></div>`],
 items:['Items','Catalogue, prices and KRA mappings.',()=>table(['Item','SKU','Price','Unit','KRA mapping','Status'],'No items yet','Add an item once your KRA reference data is synced.','+ Add item',search('Search items'))],
 orders:['Sales / Orders','Create orders and view sale line items.',()=>table(['Order ref','Date','Items','Total','Status'],'No orders yet','Orders you create appear here with the reference customers use as the PayBill account number.','+ Create order',search('Search by order reference'))],
 payments:['Payments','Received, matched, unmatched and failed payments.',()=>table(['M-Pesa ref','Order ref','Amount','Time','Match status'],'No payments yet','Payments arrive here once your PayBill is connected.')],
 invoices:['Invoices','Fiscalization status and KRA receipt details.',()=>table(['Invoice no.','KRA receipt no.','Order ref','Total','Fiscal status'],'No invoices yet','Invoices appear after a matched payment is sent to KRA.')],
 customers:['Customers','Known buyers associated with your sales.',()=>table(['Buyer','Phone','Receipts','Last purchase'],'No customers yet','Buyers appear here when their receipts are linked to your sales.')],
 reports:['Reports','Sales, payments, reconciliation and invoices.',()=>`<div class="card2">${empty('No reports yet','Reports become available once sales and payments are recorded.')}</div>`],
 settings:['Settings','Business profile, connections, branches and access.',()=>`<div class="card2"><h3>Business profile</h3>${dl([['Trading name',ses.business],['KRA PIN',ses.pin],['Taxpayer name',ses.kraName],['Taxpayer type',ses.type],['PIN status',ses.status],['Business type',ses.businessType],['Business phone',ses.businessPhone]])}</div>
 <div class="card2"><h3>Account owner</h3>${dl([['Name',ses.name],['Phone',ses.phone],['Email',ses.email]])}</div>
 <div class="card2"><h3>Connections</h3>${mp.map(c=>st(c.type+' '+esc(c.shortcode),c.callback==='REGISTERED'?'Callbacks registered':'Callbacks pending',c.callback==='REGISTERED')).join('')||st('M-Pesa','Not connected')}${st('KRA eTIMS / OSCU',kS,kS==='Connected')}</div>`]};
const B={
 dash:['Dashboard','Your purchases and fiscal receipts in one place.',()=>`<h2 style="margin-bottom:14px">Welcome, ${esc(first)}</h2><div class="card2 ready"><h3>✓ You're ready to receive eTIMS receipts</h3><p>Your phone is verified and linked to your KRA PIN. When you pay participating merchants with M-Pesa, your fiscal receipt is sent to this phone by SMS.</p><p style="margin-top:8px">Registered phone: <b>${esc(ses.phone)}</b></p></div>
 <div class="kpis">${kpi('Total receipts',0)}${kpi('This month','KSh 0.00')}</div>
 <div class="grid2"><div class="card2"><h3>Recent receipts</h3>${empty('No receipts yet','When a purchase is fiscalized and linked to you, its receipt will appear here.')}</div><div class="card2"><h3>My merchants</h3>${empty('No merchants yet','Merchants appear automatically as receipts are linked to your account.')}</div></div>`],
 receipts:['My Receipts','Search your receipt history by date and merchant.',()=>table(['Date','Merchant','Receipt no.','Amount','Status'],'No receipts yet','Receipts linked to you will be listed here.',null,search('Search merchant or receipt number'))],
 merchants:['My Merchants','Generated from the receipts linked to your account.',()=>`<div class="card2">${empty('No merchants yet','You do not need to connect to each merchant manually.')}</div>`],
 profile:['Profile','Verified phone, email and KRA details.',()=>`<div class="card2"><h3>Taxpayer information (from KRA)</h3>${dl([['Name',ses.name],['KRA PIN',ses.pin],['Taxpayer type',ses.type],['PIN status',ses.status]])}</div><div class="card2"><h3>Contact</h3>${dl([['Phone',ses.phone],['Email',ses.email||'Not added']])}<br><span class="pill ok">SMS receipts enabled</span></div>`],
 help:['Help & Support','Receipt access and purchase support.',()=>`<div class="card2"><p><b>Where is my receipt?</b><br>It is sent by SMS after a fiscalized M-Pesa payment and appears under My Receipts once linked to you.</p><p style="margin-top:14px"><b>Need support?</b><br>Contact the support team using the chat button on the home page.</p></div>`]};
const C=role==='merchant'?M:B,keys=Object.keys(C),nm=role==='merchant'?ses.business:ses.name;
document.body.insertAdjacentHTML('afterbegin',`<aside class="side"><a class="brand" href="index.html"><span class="logo">e</span>eTIMS AutoInvoice</a>${keys.map(k=>`<a class="it" data-k="${k}"><svg viewBox="0 0 24 24"><path d="${IC[k]}"/></svg>${C[k][0]}</a>`).join('')}<a class="it out" id="out"><svg viewBox="0 0 24 24"><path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/></svg>Logout</a></aside><div class="main"><div class="top2"><b>${esc(nm)}${role==='merchant'?' ▾':''}</b>${role==='merchant'?'<span class="badge">Sandbox</span>':''}<div class="who"><span>${esc(ses.name)}</span><span class="av">${esc((ses.name||'?')[0])}</span></div></div><div class="pg" id="pg"></div></div>`);
const go=k=>{if(!C[k])k=keys[0];const[t,d,f]=C[k];$('#pg').innerHTML=`<h1>${t}</h1><p class="sub">${d}</p>${f()}`;
 document.querySelectorAll('.side .it[data-k]').forEach(a=>a.classList.toggle('on',a.dataset.k===k));location.hash=k;
 document.querySelectorAll('[data-soon]').forEach(b=>b.onclick=()=>toast('Available once the database is connected.'))};
document.querySelectorAll('.side .it[data-k]').forEach(a=>a.onclick=()=>go(a.dataset.k));
$('#out').onclick=()=>{localStorage.removeItem('token');location='index.html'};
go(location.hash.slice(1));
