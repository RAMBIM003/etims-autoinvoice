const base=()=>process.env.MPESA_BASE_URL||'https://sandbox.safaricom.co.ke';
async function token(){
 const k=process.env.MPESA_CONSUMER_KEY,s=process.env.MPESA_CONSUMER_SECRET;
 if(!k||!s)throw new Error('Daraja credentials are not configured');
 const r=await fetch(base()+'/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+Buffer.from(`${k}:${s}`).toString('base64')}});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.access_token)throw new Error('Daraja authorization failed');return j.access_token}
// Daraja rejects callback URLs containing words like "mpesa", so the paths use /api/pay/c2b
async function registerUrls(shortcode){
 const pub=process.env.PUBLIC_BASE_URL;
 if(!pub)return{ok:false,error:'PUBLIC_BASE_URL is not set'};
 try{
  const r=await fetch(base()+'/mpesa/c2b/v2/registerurl',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},
   body:JSON.stringify({ShortCode:shortcode,ResponseType:'Completed',ConfirmationURL:pub+'/api/pay/c2b/confirmation',ValidationURL:pub+'/api/pay/c2b/validation'})});
  const j=await r.json().catch(()=>({}));
  return r.ok&&(j.ResponseCode==='0'||/success/i.test(j.ResponseDescription||''))?{ok:true}:{ok:false,error:String(j.errorMessage||j.ResponseDescription||'Daraja rejected the registration').slice(0,200)}
 }catch(e){return{ok:false,error:e.message}}}
module.exports={registerUrls};
