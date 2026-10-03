fetch('chat.html').then(r=>r.text()).then(h=>{
 document.body.insertAdjacentHTML('beforeend',h);
 const p=document.getElementById('chatPanel'),b=document.getElementById('chatBtn');
 const tog=()=>{const o=p.classList.toggle('open');b.textContent=o?'⌄':'💬'};
 b.onclick=tog;document.getElementById('chatX').onclick=tog;
 p.querySelectorAll('.chat-tabs button').forEach(t=>t.onclick=()=>{
  p.querySelectorAll('.chat-tabs button,.tab').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');p.querySelector('#tab-'+t.dataset.t).classList.add('on')});
 p.querySelectorAll('.cbox a[href^="#"]').forEach(a=>a.onclick=tog);
 document.getElementById('helpSearch').oninput=e=>p.querySelectorAll('#faq li').forEach(li=>
  li.style.display=li.textContent.toLowerCase().includes(e.target.value.toLowerCase())?'':'none');
}).catch(()=>console.warn('chat.html did not load: open the site through a local server (e.g. VS Code Live Server).'));
