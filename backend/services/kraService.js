let tok=null,exp=0;
const fail=(m,status)=>Object.assign(new Error(m),{status});
async function token(){
 if(tok&&Date.now()<exp)return tok;
 const k=process.env.KRA_CONSUMER_KEY,s=process.env.KRA_CONSUMER_SECRET;
 if(!k||!s)throw fail('KRA credentials are not configured',500);
 const r=await fetch(process.env.KRA_TOKEN_URL||'https://api.kra.go.ke/v1/token/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+Buffer.from(`${k}:${s}`).toString('base64')}});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.access_token)throw fail('KRA authorization failed',502);
 tok=j.access_token;exp=Date.now()+(Number(j.expires_in||3600)-60)*1000;return tok}
async function validatePin(pin){
 const call=t=>fetch(process.env.KRA_PIN_CHECK_URL||'https://api.kra.go.ke/checker/v1/pinbypin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({KRAPIN:pin})});
 let r=await call(await token());
 if(r.status===401){tok=null;r=await call(await token())}
 const j=await r.json().catch(()=>({}));
 if(j.ResponseCode==='19005')return{valid:false,code:j.ResponseCode,message:j.Message,raw:j};
 if(!r.ok||!j.PINDATA)throw fail('KRA PIN check failed',502);
 const d=j.PINDATA;
 return{valid:true,pin:d.KRAPIN,name:d.Name,type:d.TypeOfTaxpayer,status:d.StatusOfPIN,code:j.ResponseCode,message:j.Message,raw:j}}
module.exports={validatePin};
