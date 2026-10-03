const path=require('path');require('dotenv').config({path:path.join(__dirname,'../.env')});
const{Client}=require('pg');
(async()=>{
 const c=new Client({host:process.env.DB_HOST||'localhost',port:+process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:'postgres'});
 await c.connect();const n=(process.env.DB_NAME||'etims_db').replace(/[^a-zA-Z0-9_]/g,'');
 if((await c.query('SELECT 1 FROM pg_database WHERE datname=$1',[n])).rowCount)console.log(`Database ${n} already exists`);
 else{await c.query(`CREATE DATABASE "${n}"`);console.log(`Created database ${n}`)}
 await c.end()})().catch(e=>{console.error('Failed:',e.message);process.exit(1)});
