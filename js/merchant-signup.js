const $=i=>document.getElementById(i),hide=(i,h)=>$(i).classList.toggle('hide',h),say=t=>$('msg').textContent=t||'';
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const D=()=>JSON.parse(sessionStorage.mdraft||'{}'),save=d=>sessionStorage.mdraft=JSON.stringify(d);
const boxes=[...document.querySelectorAll('.otp input')],code=()=>boxes.map(b=>b.value).join('');
const persist=()=>save({...D(),fullname:$('fullname').value,phone:$('phone').value,email:$('email').value});
['fullname','phone','email'].forEach(k=>{if(D()[k])$(k).value=D()[k];$(k).oninput=persist});
boxes.forEach((b,i)=>{b.oninput=()=>{b.value=b.value.replace(/\D/g,'');if(b.value&&boxes[i+1])boxes[i+1].focus()};
 b.onkeydown=e=>{if(e.key==='Backspace'&&!b.value&&boxes[i-1])boxes[i-1].focus()}});
function refresh(){const d=D(),b=d.business,fl=document.querySelectorAll('.flowbar span');
 if(d.phoneVerified){hide('sendOtp',true);hide('pOk',false);$('phone').readOnly=true}
 hide('bizOff',!!b);hide('bizOn',!b);
 if(b)$('bz').innerHTML=`<b>${esc(b.tradingName)}</b><br>KRA: ${esc(b.kraName)} (${esc(b.pin)}) · ${esc(b.kraStatus)}<br>${b.paybill?'Paybill '+esc(b.paybill)+' ':''}${b.till?'Till '+esc(b.till):''}<br>${b.oscu&&b.oscu.connected?'<span class="px ok">KRA eTIMS connected</span>':'<span class="px no">KRA eTIMS not connected</span>'}`;
 hide('fin',!(b&&d.phoneVerified));
 fl[0].className=d.phoneVerified?'done':'on';fl[1].className=b?'done':(d.phoneVerified?'on':'');fl[2].className=b&&d.phoneVerified?'on':''}
const sendCode=async()=>{say();
 if(!API.phoneOk($('phone').value))return say('Enter a valid mobile number, e.g. 0712 345 678.');
 $('sendOtp').disabled=true;
 try{await API.post('/otp/send',{phone:$('phone').value,purpose:'SIGNUP_MERCHANT'});$('sentTo').textContent=$('phone').value;hide('otpBox',false);boxes[0].focus()}catch(e){say(e.message)}
 $('sendOtp').disabled=false};
$('sendOtp').onclick=sendCode;$('resend').onclick=e=>{e.preventDefault();sendCode()};
$('verify').onclick=async()=>{say();if(code().length<6)return say('Enter the 6-digit code.');
 try{await API.post('/otp/verify',{phone:$('phone').value,code:code(),purpose:'SIGNUP_MERCHANT'});save({...D(),phoneVerified:true});hide('otpBox',true);refresh()}catch(e){say(e.message)}};
$('bizBtn').onclick=persist;
$('f').onsubmit=async e=>{e.preventDefault();persist();const d=D();
 if(!d.fullname?.trim())return say("Enter the owner's full name.");
 if(!$('email').checkValidity()||!d.email)return say('Enter a valid email address.');
 if($('password').value.length<8)return say('Password must be at least 8 characters.');
 if($('password').value!==$('confirm').value)return say('Passwords do not match.');
 if(!$('consent').checked)return say('Tick the box to agree to the terms.');
 $('create').disabled=true;
 try{const r=await API.post('/merchant/register',{fullName:d.fullname,phone:d.phone,email:d.email,password:$('password').value,consent:true,
   business:{tradingName:d.business.tradingName,pin:d.business.pin,phone:d.business.phone,type:d.business.type,paybill:d.business.paybill,till:d.business.till}});
  localStorage.token=r.token;sessionStorage.removeItem('mdraft');location='merchant.html'}
 catch(x){say(x.message);$('create').disabled=false}};
refresh();
