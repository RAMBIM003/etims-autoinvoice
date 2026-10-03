const path=require('path'),fs=require('fs');require('dotenv').config({path:path.join(__dirname,'../.env')});
const db=require('../db');
(async()=>{
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const dir=path.join(__dirname,'../../database/migrations'),done=new Set((await db.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name));
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
  if(done.has(f))continue;
  await db.tx(async c=>{await c.query(fs.readFileSync(path.join(dir,f),'utf8'));await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[f])});
  console.log('Applied',f)}
 console.log('Database is up to date');await db.pool.end()})().catch(e=>{console.error('Migration failed:',e.message);process.exit(1)});
