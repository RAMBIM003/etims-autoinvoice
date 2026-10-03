const{Pool}=require('pg');
const pool=new Pool({host:process.env.DB_HOST||'localhost',port:+process.env.DB_PORT||5432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'etims_db'});
const tx=async f=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await f(c);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}};
module.exports={pool,tx,query:(t,p)=>pool.query(t,p)};
