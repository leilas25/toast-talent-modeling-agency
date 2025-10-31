import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import fs from 'fs';

import modelsRouter from './routes/models.js';

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 10000;

/* ------------ Body parsing ------------ */
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ------------ Cookies & session ------------ */
app.use(cookieParser());
app.use(session({
  name: process.env.SESSION_NAME || 'tt_session',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: process.env.COOKIE_DOMAIN || '.toasttalent.co.za',
    httpOnly: true,
    secure: true,              // HTTPS only (true in prod)
    sameSite: 'none',          // needed with cross-site cookies
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

/* ------------ CORS (allow your sites) ------------ */
const allowedOrigins = [
  'https://toast-talent-modeling-agency.onrender.com',
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za',
  'http://localhost:10000',
  'http://localhost:3000'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

/* ------------ Sanity / Health ------------ */
app.get('/api/models-sanity', (req, res) => {
  res.json({ sanity: true, commit: process.env.DEPLOY_COMMIT || 'local', env: process.env.NODE_ENV || 'unknown' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

/* ------------ Admin login (session-based) ------------ */
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // set in Render dashboard
  if (password && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true, message: 'Login successful' });
  }
  return res.status(401).json({ ok: false, message: 'Incorrect password' });
});

app.post('/api/admin-logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('tt_session');
    res.json({ ok: true });
  });
});

/* ------------ API routes ------------ */
app.use('/api/models', modelsRouter);

/* ------------ Static assets ------------ */
try {
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('✅ Static middleware mounted.');
} catch (e) {
  console.error('⚠️ Failed to mount static middleware (non-fatal):', e);
}

/* ------------ SPA fallback (safe) ------------ */
app.use((req, res, next) => {
  try {
    if (req.method !== 'GET') return next();
    if (req.path && req.path.startsWith('/api/')) return next();

    const candidate = path.join(__dirname, 'public', decodeURIComponent(req.path.replace(/^\//, '')));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next();

    const indexFile = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile, err => {
        if (err) {
          console.error('Error sending index.html fallback:', err);
          return next();
        }
      });
    }
    next();
  } catch (err) {
    console.error('Error in SPA fallback middleware:', err);
    next();
  }
});

/* ------------ Start server ------------ */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
