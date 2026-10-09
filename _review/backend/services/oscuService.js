// Talks to KRA eTIMS OSCU with the Masterclass test credentials from .env. The CMC key never leaves the server.
async function check(pin){
 const e=process.env,bhf=e.KRA_BRANCH_ID||'00';
 if(!e.KRA_PIN||!e.KRA_CMC_KEY||!e.KRA_DEVICE_SERIAL)return{connected:false,message:'OSCU credentials are not configured on the server'};
 if(String(pin).toUpperCase()!==e.KRA_PIN.toUpperCase())return{connected:false,message:'The POC OSCU device is set up for a different taxpayer'};
 try{
  const r=await fetch((e.OSCU_BASE_URL||'')+(e.OSCU_CHECK_PATH||'/selectCodeList'),{method:'POST',
   headers:{'Content-Type':'application/json',tin:e.KRA_PIN,bhfId:bhf,cmcKey:e.KRA_CMC_KEY},
   body:JSON.stringify({tin:e.KRA_PIN,bhfId:bhf,lastReqDt:'20180523000000'})});
  const j=await r.json().catch(()=>({})),ok=r.ok&&j.resultCd==='000';
  return{connected:ok,message:ok?'Connected to KRA eTIMS':(j.resultMsg||'KRA did not accept the connection')}
 }catch{return{connected:false,message:'Could not reach KRA eTIMS'}}}
module.exports={check};
