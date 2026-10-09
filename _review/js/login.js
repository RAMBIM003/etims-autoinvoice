const $=i=>document.getElementById(i),say=t=>$('msg').textContent=t||'';
const enter=async r=>{localStorage.token=r.token;const me=await API.get('/auth/me');location=me&&me.merchant?'merchant.html':'buyer.html'};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));
 $('pwForm').classList.toggle('hide',b.dataset.m!=='pw');$('otpForm').classList.toggle('hide',b.dataset.m!=='otp');say()});
$('pwForm').onsubmit=async e=>{e.preventDefault();say();
 try{await enter(await API.post('/auth/login',{identifier:e.target.ident.value,password:e.target.password.value}))}catch(x){say(x.message)}};
$('osend').onclick=async()=>{say();
 if(!API.phoneOk($('op').value))return say('Enter a valid mobile number.');
 try{await API.post('/otp/send',{phone:$('op').value,purpose:'LOGIN'});$('ocode').classList.remove('hide');say('If this number has an account, a code was sent.')}catch(x){say(x.message)}};
$('otpForm').onsubmit=async e=>{e.preventDefault();say();
 try{await enter(await API.post('/auth/login-otp',{phone:$('op').value,code:$('oc').value}))}catch(x){say(x.message)}};
