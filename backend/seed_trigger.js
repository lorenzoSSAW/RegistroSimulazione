// seed_trigger.js - trigger remote seed (if needed)
const fetch = require('node-fetch');
const url = process.env.BACKEND_URL || 'http://localhost:4000';
const secret = process.env.SEED_SECRET || 'change_this_secret';
(async ()=>{
  try{
    const res = await fetch(url + '/api/seed', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ secret }) });
    const data = await res.json();
    console.log('seed result', data);
  }catch(e){console.error(e)}
})();