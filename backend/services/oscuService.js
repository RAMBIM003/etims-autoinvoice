const base=()=>process.env.OSCU_BASE_URL||'https://etims-api-sbx.kra.go.ke/etims-api';
const json=async r=>r.json().catch(()=>({}));

async function request(path, body){
 const e=process.env;
 const r=await fetch(base()+path,{method:'POST',headers:{'Content-Type':'application/json',tin:e.KRA_PIN,bhfId:e.KRA_BRANCH_ID||'00',cmcKey:e.KRA_CMC_KEY},body:JSON.stringify(body)});
 const data=await json(r);
 return {ok:r.ok,data,httpStatus:r.status};
}

async function check(pin){
 const e=process.env;
 if(!e.KRA_PIN||!e.KRA_CMC_KEY||!e.KRA_DEVICE_SERIAL)return{connected:false,message:'OSCU credentials are not configured on the server'};
 if(String(pin).toUpperCase()!==String(e.KRA_PIN).toUpperCase())return{connected:false,message:'The POC OSCU device is set up for a different taxpayer'};
 try{
  const r=await request('/selectCodeList',{tin:e.KRA_PIN,bhfId:e.KRA_BRANCH_ID||'00',lastReqDt:'20180523000000'});
  return {connected:r.ok&&r.data.resultCd==='000',resultCd:r.data.resultCd||null,message:r.ok&&r.data.resultCd==='000'?'Connected to KRA eTIMS':(r.data.resultMsg||'KRA did not accept the connection')};
 }catch{return{connected:false,message:'Could not reach KRA eTIMS'}}
}

async function getBranches(){
 const e=process.env;
 return request('/selectBhfList',{tin:e.KRA_PIN,bhfId:e.KRA_BRANCH_ID||'00'});
}

async function getCodeList(){
 const e=process.env;
 return request('/selectCodeList',{tin:e.KRA_PIN,bhfId:e.KRA_BRANCH_ID||'00',lastReqDt:'20180523000000'});
}

module.exports={check,getBranches,getCodeList};
