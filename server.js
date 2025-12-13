// server.js
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import fs from 'fs';
import multer from 'multer';
import sgMail from '@sendgrid/mail';
import cors from 'cors';

import modelsRouter from './routes/models.js';

const __dirname = path.resolve();
const app = express();

const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

/* ------------------------------------------
   Trust proxy (secure cookies behind Render)
------------------------------------------- */
app.set('trust proxy', 1);

/* ------------- Body parsing ------------- */
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ----------------- CORS ----------------- */
const allowedOrigins = new Set([
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za',
  'https://toast-talent-modeling-agency.onrender.com',
  'http://localhost:10000',
  'http://localhost:3000'
]);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      console.warn('CORS blocked origin:', origin);
      return cb(new Error('CORS: origin not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 600
  })
);

app.options('*', (req, res) => res.sendStatus(204));

/* ----------- Cookies & session ---------- */
app.use(cookieParser());
app.use(
  session({
    name: process.env.SESSION_NAME || 'tt_session',
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: IS_PROD ? process.env.COOKIE_DOMAIN || '.toasttalent.co.za' : undefined,
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

/* --------- Sanity / Health / Misc ------- */
app.get('/api/models-sanity', (req, res) => {
  res.json({
    sanity: true,
    commit: process.env.DEPLOY_COMMIT || 'local',
    env: NODE_ENV
  });
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

/* -------------- Auth helpers ------------ */
app.get('/api/whoami', (req, res) => {
  res.json({ isAdmin: !!req.session?.isAdmin, sessionID: req.sessionID || null });
});

app.get('/api/check-auth', (req, res) => {
  if (req.session?.isAdmin) return res.json({ authenticated: true });
  return res.status(401).json({ authenticated: false });
});

/* ----------- Admin login/logout --------- */
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (password && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return req.session.save(() => res.json({ ok: true }));
  }
  return res.status(401).json({ ok: false });
});

app.post('/api/admin-logout', (req, res) => {
  const cookieOptions = {
    path: '/',
    domain: IS_PROD ? process.env.COOKIE_DOMAIN || '.toasttalent.co.za' : undefined,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax'
  };
  req.session.destroy(() => {
    res.clearCookie('tt_session', cookieOptions);
    res.json({ ok: true });
  });
});

/* --------------- Models API ------------- */
app.use('/api/models', modelsRouter);

/* --------- SendGrid setup --------- */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/* ==================================================
   CLEAN URL ROUTES (ADDED – NOTHING ELSE CHANGED)
================================================== */
const page = (file) =>
  path.join(__dirname, 'public', file);

app.get('/', (req, res) => res.sendFile(page('index.html')));
app.get('/about', (req, res) => res.sendFile(page('about.html')));
app.get('/contact', (req, res) => res.sendFile(page('contact.html')));
app.get('/models', (req, res) => res.sendFile(page('models.html')));
app.get('/apply', (req, res) => res.sendFile(page('apply.html')));
app.get('/admin', (req, res) => res.sendFile(page('admin/index.html')));

/* ------------- Static assets ------------ */
app.use(express.static(path.join(__dirname, 'public')));
console.log('✅ Static middleware mounted.');

/* -------- SPA fallback (safe) ---------- */
app.use((req, res, next) => {
  try {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();

    const candidate = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(candidate)) return next();

    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    next();
  }
});

/* --------------- Start server ----------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
});
