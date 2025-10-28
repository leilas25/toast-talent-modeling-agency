import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';
import modelsRouter from './routes/models.js';

const __dirname = path.resolve();

const app = express();
const PORT = process.env.PORT || 10000;

// Basic body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Cookie parser (useful for debugging, session middleware reads cookies)
app.use(cookieParser());

// Session - cookie settings allow cross-subdomain cookie for .toasttalent.co.za
// IMPORTANT: set SESSION_SECRET in your Render env. In production use a secure store.
app.use(session({
  name: 'tt_session',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: process.env.COOKIE_DOMAIN || '.toasttalent.co.za',
    httpOnly: true,
    secure: true,         // requires HTTPS in production
    sameSite: 'none',     // allow cross-site cookies (admin on toasttalent.co.za -> api.toasttalent.co.za)
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// CORS: allow the admin origin and API origin, and allow credentials.
const allowedOrigins = [
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    // don't set wildcard when credentials are used
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Mount models API (router handles /)
app.use('/api/models', modelsRouter);

// Admin login endpoint: sets session.isAdmin if password matches env var
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASS = process.env.ADMIN_PASS || 'YumnaGugu1980';
  if (password === ADMIN_PASS) {
    req.session.isAdmin = true;
    // send a short JSON response — the session cookie will be set on the api domain
    return res.json({ ok: true, redirect: '/admin' });
  }
  return res.status(401).json({ ok: false, message: 'Incorrect password' });
});

// Optional: health
app.get('/health', (req, res) => res.json({ ok: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback SPA handling for unknown non-API GETs
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});