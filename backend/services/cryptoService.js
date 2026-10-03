const crypto=require('crypto');
const fail=(m)=>Object.assign(new Error(m),{status:500});
const key=()=>{const k=process.env.ENC_KEY||'';if(!/^[0-9a-f]{64}$/i.test(k))throw fail('ENC_KEY must be 64 hex characters');return Buffer.from(k,'hex')};
const norm=p=>{p=String(p||'').replace(/[\s+]/g,'');return p.startsWith('0')?'254'+p.slice(1):p};
const hmac=v=>{if(!process.env.HMAC_KEY)throw fail('HMAC_KEY is not set');return crypto.createHmac('sha256',process.env.HMAC_KEY).update(v).digest('hex')};
const enc=t=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv),b=Buffer.concat([c.update(t,'utf8'),c.final()]);return [iv,c.getAuthTag(),b].map(x=>x.toString('hex')).join('.')};
const dec=s=>{const[iv,tag,b]=s.split('.').map(x=>Buffer.from(x,'hex')),d=crypto.createDecipheriv('aes-256-gcm',key(),iv);d.setAuthTag(tag);return Buffer.concat([d.update(b),d.final()]).toString('utf8')};
module.exports={norm,hmac,enc,dec,phoneHash:p=>hmac('phone:'+norm(p)),phoneOk:p=>/^254[17]\d{8}$/.test(norm(p)),mask:p=>p?'+'+p.slice(0,4)+' *** '+p.slice(-3):''};
