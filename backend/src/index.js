import express from 'express';
import http from 'node:http';
import cors from 'cors';
import path from 'node:path';
import { Server } from 'socket.io';
import multer from 'multer';
import { nanoid } from 'nanoid';

import { requireAdmin } from './auth.js';
import { ensureDataDir, getDataDir, readDb, writeDb } from './store.js';

const PORT = Number(process.env.PORT || 8080);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

await ensureDataDir();

const app = express();
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = new Set(
  String(CLIENT_ORIGIN)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

// Helpful defaults for local dev
allowedOrigins.add('http://localhost:5173');
allowedOrigins.add('http://127.0.0.1:5173');

app.use(
  cors({
    origin: true,  // Allow all origins in development
    credentials: false
  })
);

const uploadsDir = path.join(getDataDir(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Public branding
app.get('/api/branding', async (req, res) => {
  const db = await readDb();
  res.json(db.branding);
});

// Admin branding
app.post('/api/admin/branding', requireAdmin, upload.single('banner'), async (req, res) => {
  const db = await readDb();
  const theme = req.body?.theme;
  if (theme) db.branding.theme = theme;
  if (req.file) db.branding.bannerPath = `/uploads/${req.file.filename}`;
  else db.branding.bannerPath = null;
  await writeDb(db);
  res.json(db.branding);
});

// Question Sets CRUD
app.get('/api/admin/question-sets', requireAdmin, async (req, res) => {
  const db = await readDb();
  res.json(db.questionSets || []);
});

app.post('/api/admin/question-sets', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.questionSets) db.questionSets = [];
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  
  const qs = {
    id: nanoid(),
    name: String(name).slice(0, 100),
    description: String(description || '').slice(0, 500),
    createdAt: new Date().toISOString()
  };
  db.questionSets.push(qs);
  await writeDb(db);
  res.json(qs);
});

app.put('/api/admin/question-sets/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.questionSets) db.questionSets = [];
  const idx = db.questionSets.findIndex((qs) => qs.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  
  const { name, description } = req.body;
  db.questionSets[idx] = {
    ...db.questionSets[idx],
    name: name ? String(name).slice(0, 100) : db.questionSets[idx].name,
    description: description !== undefined ? String(description).slice(0, 500) : db.questionSets[idx].description
  };
  await writeDb(db);
  res.json(db.questionSets[idx]);
});

app.delete('/api/admin/question-sets/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.questionSets) return res.status(404).json({ error: 'Not found' });
  if (req.params.id === 'default') return res.status(400).json({ error: 'Cannot delete default set' });
  
  const before = db.questionSets.length;
  db.questionSets = db.questionSets.filter((qs) => qs.id !== req.params.id);
  if (db.questionSets.length === before) return res.status(404).json({ error: 'Not found' });
  
  // Move orphaned questions to default set
  db.questions.forEach((q) => {
    if (q.setId === req.params.id) q.setId = 'default';
  });
  
  await writeDb(db);
  res.json({ ok: true });
});

// Public login validation (no admin token required)
app.post('/api/auth/login', async (req, res) => {
  const { password, role } = req.body;
  if (!password || !role) return res.status(400).json({ error: 'Password and role required' });
  
  const db = await readDb();
  
  // Ensure default users exist (migration for existing databases)
  if (!db.users || db.users.length === 0) {
    db.users = [
      { id: 'admin_default', username: 'admin', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() },
      { id: 'host_default', username: 'host', password: 'host123', role: 'host', createdAt: new Date().toISOString() }
    ];
    await writeDb(db);
  }
  
  const user = db.users.find(u => u.password === password && u.role === role);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  res.json({ ok: true, role: user.role, username: user.username });
});

// User management (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const db = await readDb();
  const users = (db.users || []).map(u => ({ ...u, password: '***' }));
  res.json(users);
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.users) db.users = [];
  
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Username, password, and role required' });
  if (!['admin', 'host'].includes(role)) return res.status(400).json({ error: 'Role must be admin or host' });
  
  const user = {
    id: nanoid(),
    username: String(username).slice(0, 50),
    password: String(password).slice(0, 100),
    role,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  res.json({ ...user, password: '***' });
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.users) return res.status(404).json({ error: 'Not found' });
  
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  
  const { username, password, role } = req.body;
  if (role && !['admin', 'host'].includes(role)) return res.status(400).json({ error: 'Role must be admin or host' });
  
  db.users[idx] = {
    ...db.users[idx],
    username: username ? String(username).slice(0, 50) : db.users[idx].username,
    password: password ? String(password).slice(0, 100) : db.users[idx].password,
    role: role || db.users[idx].role
  };
  await writeDb(db);
  res.json({ ...db.users[idx], password: '***' });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.users) return res.status(404).json({ error: 'Not found' });
  
  const before = db.users.length;
  db.users = db.users.filter(u => u.id !== req.params.id);
  if (db.users.length === before) return res.status(404).json({ error: 'Not found' });
  
  await writeDb(db);
  res.json({ ok: true });
});

// Player archive
app.get('/api/admin/player-archive', requireAdmin, async (req, res) => {
  const db = await readDb();
  res.json(db.playerArchive || []);
});

app.delete('/api/admin/player-archive/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  if (!db.playerArchive) return res.status(404).json({ error: 'Not found' });
  
  db.playerArchive = db.playerArchive.filter(p => p.id !== req.params.id);
  await writeDb(db);
  res.json({ ok: true });
});

// Admin question CRUD
app.get('/api/admin/questions', requireAdmin, async (req, res) => {
  const db = await readDb();
  res.json(db.questions);
});

app.post('/api/admin/questions', requireAdmin, upload.single('image'), async (req, res) => {
  const db = await readDb();
  const { type, promptHtml, optionsJson, correctJson, points, setId } = req.body;

  if (!type || !promptHtml) return res.status(400).json({ error: 'Missing type or promptHtml' });

  const q = {
    id: nanoid(),
    type,
    promptHtml,
    imagePath: req.file ? `/uploads/${req.file.filename}` : null,
    options: optionsJson ? JSON.parse(optionsJson) : null,
    correct: correctJson ? JSON.parse(correctJson) : null,
    points: Number(points || 0),
    setId: setId || 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // basic validation
  if (q.type === 'open' && q.correct != null) q.correct = null;
  if (q.type === 'open' && q.points < 0) q.points = 0;

  db.questions.unshift(q);
  await writeDb(db);
  res.json(q);
});

app.put('/api/admin/questions/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const db = await readDb();
  const idx = db.questions.findIndex((q) => q.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });

  const existing = db.questions[idx];
  const { type, promptHtml, optionsJson, correctJson, points, setId } = req.body;

  const updated = {
    ...existing,
    type: type ?? existing.type,
    promptHtml: promptHtml ?? existing.promptHtml,
    options: optionsJson ? JSON.parse(optionsJson) : existing.options,
    correct: correctJson ? JSON.parse(correctJson) : existing.correct,
    points: points != null ? Number(points) : existing.points,
    setId: setId || existing.setId || 'default',
    imagePath: req.file ? `/uploads/${req.file.filename}` : existing.imagePath,
    updatedAt: new Date().toISOString()
  };

  db.questions[idx] = updated;
  await writeDb(db);
  res.json(updated);
});

app.delete('/api/admin/questions/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const before = db.questions.length;
  db.questions = db.questions.filter((q) => q.id !== req.params.id);
  if (db.questions.length === before) return res.status(404).json({ error: 'Not found' });
  await writeDb(db);
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,  // Allow all origins
    methods: ['GET', 'POST']
  }
});

// In-memory live sessions
// roomCode -> { roomCode, hostSocketId, phase, currentQuestionId, endsAt, answers: Map(playerId->payload), players: Map(playerId->player), scores: Map(playerId->number) }
const sessions = new Map();

function makeRoomCode() {
  return nanoid(6).toUpperCase();
}

function publicSessionState(s) {
  return {
    roomCode: s.roomCode,
    phase: s.phase,
    currentQuestionId: s.currentQuestionId,
    endsAt: s.endsAt,
    players: Array.from(s.players.values()).map((p) => ({ id: p.id, nickname: p.nickname })),
    scores: Array.from(s.scores.entries()).map(([playerId, score]) => ({ playerId, score }))
  };
}

io.on('connection', (socket) => {
  socket.on('host:createRoom', async (ack) => {
    const roomCode = makeRoomCode();
    const s = {
      roomCode,
      hostSocketId: socket.id,
      phase: 'lobby',
      currentQuestionId: null,
      endsAt: null,
      answers: new Map(),
      players: new Map(),
      scores: new Map()
    };
    sessions.set(roomCode, s);
    socket.join(roomCode);
    socket.data.isHost = true;
    socket.data.roomCode = roomCode;
    ack?.({ ok: true, roomCode, state: publicSessionState(s) });
    io.to(roomCode).emit('session:state', publicSessionState(s));
  });

  // Allow host to rejoin their room after navigation
  socket.on('host:rejoinRoom', async ({ roomCode }, ack) => {
    const s = sessions.get(String(roomCode || '').toUpperCase());
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    
    // Take over as host
    s.hostSocketId = socket.id;
    socket.join(s.roomCode);
    socket.data.isHost = true;
    socket.data.roomCode = s.roomCode;
    
    ack?.({ ok: true, roomCode: s.roomCode, state: publicSessionState(s) });
    io.to(s.roomCode).emit('session:state', publicSessionState(s));
  });

  // Spectator join - for leaderboard display
  socket.on('spectator:join', ({ roomCode }, ack) => {
    const s = sessions.get(String(roomCode || '').toUpperCase());
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    
    socket.join(s.roomCode);
    socket.data.isSpectator = true;
    socket.data.roomCode = s.roomCode;
    
    ack?.({ ok: true, state: publicSessionState(s) });
  });

  socket.on('player:join', async ({ roomCode, nickname, email, persistentId }, ack) => {
    const s = sessions.get(String(roomCode || '').toUpperCase());
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    if (!nickname || nickname.length < 1) return ack?.({ ok: false, error: 'Nickname required' });

    // Check if player with this persistentId already exists (reconnection)
    let player = null;
    let isNewPlayer = false;
    if (persistentId) {
      for (const p of s.players.values()) {
        if (p.persistentId === persistentId) {
          player = p;
          break;
        }
      }
    }

    if (!player) {
      // New player
      isNewPlayer = true;
      player = { 
        id: nanoid(), 
        persistentId: persistentId || nanoid(),
        nickname: String(nickname).slice(0, 40), 
        email: String(email || '').slice(0, 120) 
      };
      s.players.set(player.id, player);
      if (!s.scores.has(player.id)) s.scores.set(player.id, 0);
      
      // Archive player to database
      try {
        const db = await readDb();
        if (!db.playerArchive) db.playerArchive = [];
        // Check if already archived by persistentId
        const exists = db.playerArchive.some(p => p.persistentId === player.persistentId);
        if (!exists) {
          db.playerArchive.push({
            id: nanoid(),
            persistentId: player.persistentId,
            nickname: player.nickname,
            email: player.email,
            roomCode: s.roomCode,
            joinedAt: new Date().toISOString()
          });
          await writeDb(db);
        }
      } catch (e) {
        console.error('[PlayerArchive] Failed to archive player:', e);
      }
    }

    socket.join(s.roomCode);
    socket.data.roomCode = s.roomCode;
    socket.data.playerId = player.id;

    ack?.({ ok: true, player, state: publicSessionState(s) });
    io.to(s.roomCode).emit('session:state', publicSessionState(s));
  });

  socket.on('host:startQuestion', async ({ roomCode, questionId, durationSec }, ack) => {
    const s = sessions.get(String(roomCode || '').toUpperCase());
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    if (s.hostSocketId !== socket.id) return ack?.({ ok: false, error: 'Not host' });

    const db = await readDb();
    const q = db.questions.find((qq) => qq.id === questionId);
    if (!q) return ack?.({ ok: false, error: 'Question not found' });

    const dur = Math.max(5, Math.min(120, Number(durationSec || 20)));
    s.phase = 'question';
    s.currentQuestionId = q.id;
    s.endsAt = Date.now() + dur * 1000;
    s.answers.clear();

    io.to(s.roomCode).emit('question:show', {
      question: {
        id: q.id,
        type: q.type,
        promptHtml: q.promptHtml,
        imagePath: q.imagePath,
        options: q.options,
        points: q.points
      },
      endsAt: s.endsAt
    });
    io.to(s.roomCode).emit('session:state', publicSessionState(s));
    ack?.({ ok: true });

    setTimeout(() => {
      const s2 = sessions.get(s.roomCode);
      if (!s2) return;
      if (s2.currentQuestionId !== q.id) return;
      if (s2.phase !== 'question') return;
      finishQuestion(s2).catch(() => {});
    }, dur * 1000 + 50);
  });

  socket.on('player:answer', async ({ answer }, ack) => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) return ack?.({ ok: false, error: 'Not joined' });

    const s = sessions.get(roomCode);
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    if (s.phase !== 'question') return ack?.({ ok: false, error: 'Not accepting answers' });
    if (Date.now() > s.endsAt) return ack?.({ ok: false, error: 'Time is up' });

    const payload = {
      answer,
      at: Date.now()
    };
    if (typeof payload.answer === 'string' && payload.answer.length > 1000) {
      payload.answer = payload.answer.slice(0, 1000);
    }

    s.answers.set(playerId, payload);
    ack?.({ ok: true });
  });

  socket.on('host:finishQuestion', async ({ roomCode }, ack) => {
    const s = sessions.get(String(roomCode || '').toUpperCase());
    if (!s) return ack?.({ ok: false, error: 'Room not found' });
    if (s.hostSocketId !== socket.id) return ack?.({ ok: false, error: 'Not host' });
    await finishQuestion(s);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    // If host disconnects, keep session but hostSocketId becomes null; a new host can be added later (future)
    for (const s of sessions.values()) {
      if (s.hostSocketId === socket.id) {
        s.hostSocketId = null;
        io.to(s.roomCode).emit('session:state', publicSessionState(s));
      }
    }
  });
});

async function finishQuestion(s) {
  const db = await readDb();
  const q = db.questions.find((qq) => qq.id === s.currentQuestionId);

  s.phase = 'results';
  s.endsAt = null;

  const stats = computeStats(q, s.answers);
  if (q) {
    for (const [playerId, ans] of s.answers.entries()) {
      const add = scoreAnswer(q, ans?.answer);
      if (add > 0) s.scores.set(playerId, (s.scores.get(playerId) || 0) + add);
    }
  }

  io.to(s.roomCode).emit('question:results', {
    questionId: s.currentQuestionId,
    stats,
    correct: q?.correct ?? null,
    scores: Array.from(s.scores.entries()).map(([playerId, score]) => ({ playerId, score }))
  });
  io.to(s.roomCode).emit('session:state', publicSessionState(s));
}

function scoreAnswer(q, answer) {
  if (!q) return 0;
  const pts = Number(q.points || 0);
  if (pts <= 0) return 0;

  if (q.type === 'open') return 0;

  if (q.type === 'truefalse') {
    return String(answer) === String(q.correct) ? pts : 0;
  }

  if (q.type === 'multi') {
    // expects answer: array of option ids (string)
    const a = Array.isArray(answer) ? answer.map(String).sort() : [];
    const c = Array.isArray(q.correct) ? q.correct.map(String).sort() : [];
    if (a.length !== c.length) return 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) return 0;
    return pts;
  }

  return 0;
}

function computeStats(q, answersMap) {
  const answers = Array.from(answersMap.values()).map((v) => v.answer);

  if (!q) {
    return { total: answers.length };
  }

  if (q.type === 'open') {
    const samples = answers
      .filter((a) => typeof a === 'string')
      .slice(0, 50)
      .map((a) => a.slice(0, 200));
    return { total: answers.length, samples };
  }

  if (q.type === 'truefalse') {
    let t = 0;
    let f = 0;
    for (const a of answers) {
      if (String(a) === 'true') t++;
      else if (String(a) === 'false') f++;
    }
    return { total: answers.length, true: t, false: f };
  }

  if (q.type === 'multi') {
    const counts = {};
    for (const opt of q.options || []) counts[opt.id] = 0;
    for (const a of answers) {
      const arr = Array.isArray(a) ? a : [];
      for (const id of arr.map(String)) {
        if (counts[id] != null) counts[id]++;
      }
    }
    return { total: answers.length, counts };
  }

  return { total: answers.length };
}

server.listen(PORT, () => {
  console.log(`Purple Sphinx backend listening on :${PORT}`);
});
