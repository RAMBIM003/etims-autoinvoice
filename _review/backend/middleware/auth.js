const jwt=require('jsonwebtoken');
module.exports=(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').replace(/^Bearer /,''),process.env.JWT_SECRET);n()}catch{s.status(401).json({error:'Please sign in'})}};
module.exports.sign=id=>jwt.sign({sub:id},process.env.JWT_SECRET,{expiresIn:'12h'});
