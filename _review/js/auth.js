// Front-end stub: replace with real API calls once the backend exists.
const msg=t=>document.getElementById('msg').textContent=t;
const f=document.querySelector('form[data-role]');
if(f)f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));
 if(d.password.length<8)return msg('Password must be at least 8 characters.');
 if(d.password!==d.confirm)return msg('Passwords do not match.');
 const u=JSON.parse(localStorage.users||'[]');
 u.push({username:d.username.toLowerCase(),email:(d.email||'').toLowerCase(),role:f.dataset.role});
 localStorage.users=JSON.stringify(u);location='log.html?new=1'};
const l=document.getElementById('loginForm');
if(l){if(location.search.includes('new'))msg('Account created. Sign in to continue.');
 l.onsubmit=e=>{e.preventDefault();const id=l.login.value.trim().toLowerCase();
 const u=JSON.parse(localStorage.users||'[]').find(x=>x.username===id||x.email===id);
 if(!u)return msg('No account found. Check your details or register.');
 location=u.role==='merchant'?'merchant.html':'buyer.html'}}
