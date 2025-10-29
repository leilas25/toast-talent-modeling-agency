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

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Cookies & session
app.use(cookieParser());
app.use(session({
  name: process.env.SESSION_NAME || 'tt_session',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: process.env.COOKIE_DOMAIN || '.toasttalent.co.za',
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// CORS-lite
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
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Sanity endpoint
app.get('/api/models-sanity', (req, res) => {
  res.json({ sanity: true, commit: process.env.DEPLOY_COMMIT || 'local', env: process.env.NODE_ENV || 'unknown' });
});

// Mount models router (safe)
try {
  console.log('Mounting models router at /api/models');
  app.use('/api/models', modelsRouter);
  console.log('Mounted models router OK');
} catch (err) {
  console.error('Error mounting models router:', err && err.stack ? err.stack : err);
}

// Admin login (unchanged)
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASS = process.env.ADMIN_PASS || 'YumnaGugu1980';
  if (password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true, redirect: '/admin' });
  }
  return res.status(401).json({ ok: false, message: 'Incorrect password' });
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Attempt to serve static assets (non-fatal)
try {
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('Static middleware mounted (attempted).');
} catch (e) {
  console.error('Failed to mount static middleware at startup (non-fatal).', e && e.stack ? e.stack : e);
}

// SAFE SPA fallback: register a middleware (no path string compiled by path-to-regexp).
// This checks for API routes and existing static files first, then sends index.html for SPA.
app.use((req, res, next) => {
  try {
    // Only handle GET requests
    if (req.method !== 'GET') return next();

    // Don't interfere with API
    if (req.path && req.path.startsWith('/api/')) return next();

    // If the request maps to an actual file under public, let static middleware handle it
    const candidate = path.join(__dirname, 'public', decodeURIComponent(req.path.replace(/^\//, '')));
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return next(); // file exists: serve by static middleware
      }
    } catch (e) {
      // ignore fs errors and continue to serve index.html fallback
    }

    // Serve index.html for SPA routes
    const indexFile = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile, err => {
        if (err) {
          console.error('Error sending index.html fallback:', err && err.stack ? err.stack : err);
          return next();
        }
      });
    } else {
      // no index to send, continue (so API still works)
      return next();
    }
  } catch (outerErr) {
    console.error('Error in SPA fallback middleware (non-fatal):', outerErr && outerErr.stack ? outerErr.stack : outerErr);
    return next();
  }
});

// Listen
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});