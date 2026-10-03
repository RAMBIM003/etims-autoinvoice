// Talks to the Node backend in /backend. No sample data lives here.
const API={BASE:'http://localhost:5000/api',
 norm:v=>{v=String(v).replace(/[\s+]/g,'');return v.startsWith('0')?'254'+v.slice(1):v},
 phoneOk(v){return /^254[17]\d{8}$/.test(this.norm(v))},
 async req(path,opt={}){let r;opt.headers={...(opt.headers||{})};
  if(localStorage.token)opt.headers.Authorization='Bearer '+localStorage.token;
  try{r=await fetch(this.BASE+path,opt)}catch{throw new Error('Cannot reach the server. Start the API (npm start in /backend) and open this site through Live Server.')}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j},
 post(path,body){return this.req(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})},
 async get(path){try{return await this.req(path)}catch{return null}}};
