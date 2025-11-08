require('dotenv').config();
// server.js - RegistroSimulazione backend (Finale Replit-ready)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function initDB(){
  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    password TEXT,
    role TEXT,
    classId TEXT
  );
  CREATE TABLE IF NOT EXISTS classes (id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS presences (
    id SERIAL PRIMARY KEY, classId TEXT, studentId TEXT, date TEXT, hour INTEGER, status TEXT, byUser TEXT
  );
  CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY, classId TEXT, studentId TEXT, subject TEXT, grade INTEGER, comment TEXT, byUser TEXT
  );
  CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY, classId TEXT, studentId TEXT, text TEXT, byUser TEXT, date TEXT
  );
  CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY, classId TEXT, day TEXT, hour INTEGER, teacherId TEXT, subject TEXT
  );
  `);
}
initDB().catch(e=>console.error('DB init error',e));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  socket.on('join_class', ({ classId }) => socket.join(`class_${classId}`));
  socket.on('leave_class', ({ classId }) => socket.leave(`class_${classId}`));
  socket.on('presence_change', payload => io.to(`class_${payload.classId}`).emit('presence_updated', payload));
  socket.on('grade_change', payload => io.to(`class_${payload.classId}`).emit('grade_updated', payload));
});

app.get('/api/hello', (req,res)=>res.json({ok:true,time:new Date()}));

app.post('/api/login', async (req,res)=>{
  const { id, password } = req.body;
  try{
    const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if(r.rowCount===0) return res.status(401).json({ error: 'User not found' });
    const user = r.rows[0];
    if(user.password !== password) return res.status(401).json({ error: 'Invalid password' });
    res.json({ id: user.id, name: user.name, role: user.role, classId: user.classid });
  }catch(e){ console.error(e); res.status(500).json({ error:'db' }); }
});

app.get('/api/classes/:id', async (req,res)=>{
  const id = req.params.id;
  try{
    const students = (await pool.query('SELECT id,name,role,classid FROM users WHERE classid=$1 AND role=$2',[id,'student'])).rows;
    const pres = (await pool.query('SELECT * FROM presences WHERE classid=$1',[id])).rows;
    const grades = (await pool.query('SELECT * FROM grades WHERE classid=$1',[id])).rows;
    res.json({ id, students, presences: pres, grades });
  }catch(e){ console.error(e); res.status(500).json({ error:'db' }); }
});

app.post('/api/classes/:id/presence', async (req,res)=>{
  const id = req.params.id;
  const { studentId, date, hour, status, byUser } = req.body;
  try{
    await pool.query('INSERT INTO presences (classid, studentid, date, hour, status, byuser) VALUES ($1,$2,$3,$4,$5,$6)', [id, studentId, date, hour, status, byUser]);
    const payload = { classId:id, studentId, date, hour, status, byUser };
    io.to(`class_${id}`).emit('presence_updated', payload);
    res.json({ ok:true, payload });
  }catch(e){ console.error(e); res.status(500).json({ error:'db' }); }
});

app.post('/api/classes/:id/grade', async (req,res)=>{
  const id = req.params.id;
  const { studentId, subject, grade, comment, byUser } = req.body;
  try{
    await pool.query('INSERT INTO grades (classid, studentid, subject, grade, comment, byuser) VALUES ($1,$2,$3,$4,$5,$6)', [id, studentId, subject, grade, comment, byUser]);
    const payload = { classId:id, studentId, subject, grade, comment, byUser };
    io.to(`class_${id}`).emit('grade_updated', payload);
    res.json({ ok:true, payload });
  }catch(e){ console.error(e); res.status(500).json({ error:'db' }); }
});

app.post('/api/seed', async (req,res)=>{
  if(process.env.SEED_SECRET !== req.body.secret) return res.status(401).json({ error:'unauthorized' });
  try{
    const classes = ['1A','1B','2A','2B','3A','3B','4A','4B','5A','5B'];
    for(const c of classes){
      await pool.query('INSERT INTO classes (id) VALUES ($1) ON CONFLICT DO NOTHING',[c]);
    }
    const profs = [
      ['matteo@reg','Matteo Piccinin','1234','teacher',null],
      ['lorenzo@reg','Lorenzo Piccinin','1234','teacher',null],
      ['magic3@reg','Magic_3','1234','teacher',null],
      ['miguel@reg','Miguel','1234','teacher',null],
      ['symbol@reg','Symbol','1234','teacher',null],
      ['helen@reg','Helen Ancient','1234','teacher',null],
      ['chiara@reg','Chiara Liplp','1234','teacher',null]
    ];
    for(const p of profs){
      await pool.query('INSERT INTO users (id,name,password,role,classid) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING', p);
    }
    let idx=1;
    for(const c of classes){
      for(let i=1;i<=20;i++){
        const sid = `s${c}_${i}`;
        await pool.query('INSERT INTO users (id,name,password,role,classid) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [sid, `Studente ${idx}`, '1111', 'student', c]);
        idx++;
      }
    }
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ error:'db' }); }
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log('Server listening on', PORT));
