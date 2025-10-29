import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import modelsRouter from './routes/models.js';

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 10000;

// Optional small app.use logger (helpful)
(function patchAppUse() {
  const originalUse = app.use.bind(app);
  app.use = function (first, ...rest) {
    try {
      if (typeof first === 'string') {
        console.log('app.use called with path:', first);
      } else if (first && first.name) {
        console.log('app.use called with middleware function:', first.name);
      } else {
        console.log('app.use called with unknown first arg:', first);
      }
    } catch (e) {
      console.error('Error logging app.use args', e);
    }
    return originalUse(first, ...rest);
  };
}());

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

// Sanity endpoint
app.get('/api/models-sanity', (req, res) => {
  res.json({ sanity: true, commit: process.env.DEPLOY_COMMIT || 'local', env: process.env.NODE_ENV || 'unknown' });
});

// Mount models router
try {
  console.log('Mounting models router at /api/models');
  app.use('/api/models', modelsRouter);
  console.log('Mounted models router OK');
} catch (err) {
  console.error('Error mounting models router:', err && err.stack ? err.stack : err);
}

// Admin login
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

// Attempt to serve static frontend (non-fatal)
try {
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('Static middleware mounted (attempted).');
} catch (e) {
  console.error('Failed to mount static middleware at startup (non-fatal).', e && e.stack ? e.stack : e);
}

// --- NEW DIAGNOSTIC: dump router stack so we can find any bad mounted path ---
function dumpRouterStack() {
  try {
    if (!app._router) {
      console.log('ROUTER: no app._router present');
      return;
    }
    console.log('ROUTER: dumping stack (start)');
    app._router.stack.forEach((layer, i) => {
      try {
        const name = layer.name || '<anonymous>';
        // route-based layer (app.get('/path', ...))
        if (layer.route) {
          const methods = layer.route && layer.route.methods ? Object.keys(layer.route.methods).join(',') : '';
          const routePath = layer.route.path || JSON.stringify(layer.route);
          console.log(`ROUTER LAYER ${i}: type=route name=${name} methods=${methods} path=${routePath}`);
          // check for suspicious substrings
          if (String(routePath).includes('http') || String(routePath).includes('://') || String(routePath).includes('api.toasttalent')) {
            console.log(`POSSIBLE OFFENDING LAYER ${i}: route.path=${routePath}`);
          }
        } else { // middleware layer
          // layer.regexp (if present) is a RegExp object; convert to string
          const regexpText = layer.regexp ? (layer.regexp.toString()) : '<no-regexp>';
          // layer.path may not exist; print handle name
          const handleName = layer.handle && layer.handle.name ? layer.handle.name : '<no-handle-name>';
          console.log(`ROUTER LAYER ${i}: type=middleware name=${name} handle=${handleName} regexp=${regexpText}`);
          if (String(regexpText).includes('http') || String(regexpText).includes('://') || String(regexpText).includes('api.toasttalent')) {
            console.log(`POSSIBLE OFFENDING LAYER ${i}: regexp=${regexpText}`);
          }
        }
      } catch (inner) {
        console.log(`ROUTER LAYER ${i}: (error reading layer) ${inner && inner.message ? inner.message : inner}`);
      }
    });
    console.log('ROUTER: dumping stack (end)');
  } catch (e) {
    console.error('Error dumping router stack:', e && e.stack ? e.stack : e);
  }
}

// Dump router stack before registering fallback
dumpRouterStack();
// --- end diagnostic ---

// Attempt to mount SPA fallback, but protect startup from crashes
try {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  console.log('SPA fallback route registered (attempted).');
} catch (e) {
  console.error('Failed to register SPA fallback at startup (non-fatal).', e && e.stack ? e.stack : e);
  // Also dump router stack again to capture state at error time
  dumpRouterStack();
}

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