module.exports=f=>(q,s)=>f(q,s).catch(e=>{
 if(e.code==='23505')return s.status(409).json({error:'An account already exists for these details. Try signing in.'});
 if(!e.status)console.error(e);
 s.status(e.status||500).json({error:e.status?e.message:'Something went wrong on the server'})});
