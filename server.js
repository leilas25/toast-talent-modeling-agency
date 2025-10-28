import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import modelsRouter from './routes/models.js';

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 10000;

// Basic body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Cookie parser and session
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

// CORS-ish headers middleware
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

// Temporary sanity endpoint
app.get('/api/models-sanity', (req, res) => {
  res.json({ sanity: true, commit: process.env.DEPLOY_COMMIT || 'local' });
});

// Mount models router
try {
  console.log('Mounting models router at /api/models');
  app.use('/api/models', modelsRouter);
  console.log('Mounted models router OK');
} catch (err) {
  console.error('Error mounting models router:', err && err.stack ? err.stack : err);
}

// Admin login endpoint
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASS = process.env.ADMIN_PASS || 'YumnaGugu1980';
  if (password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true, redirect: '/admin' });
  }
  return res.status(401).json({ ok: false, message: 'Incorrect password' });
});

// Health endpoint
app.get('/health', (req, res) => res.json({ ok: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback SPA for non-API GET requests
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper: list registered routes for debugging
function listRegisteredRoutes() {
  try {
    const routes = [];
    if (!app._router) {
      console.log('No app._router present');
      return;
    }
    app._router.stack.forEach(mw => {
      if (mw.route && mw.route.path) {
        const methods = Object.keys(mw.route.methods).map(m => m.toUpperCase()).join(',');
        routes.push(`${methods} ${mw.route.path}`);
      } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
        mw.handle.stack.forEach(handler => {
          if (handler.route && handler.route.path) {
            const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase()).join(',');
            routes.push(`${methods} ${handler.route.path} (nested router)`);
          }
        });
      } else if (mw.name && mw.name !== 'bound dispatch') {
        routes.push(`MIDDLEWARE ${mw.name}`);
      }
    });
    console.log('Registered routes/middleware:', JSON.stringify(routes, null, 2));
  } catch (err) {
    console.error('Error listing routes', err && err.stack ? err.stack : err);
  }
}

listRegisteredRoutes();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});