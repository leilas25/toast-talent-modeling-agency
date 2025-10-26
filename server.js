'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// --- Instrumentation: wrap app/router registration to catch and log bad mounts ---
// This logs the method name, the first argument passed (path or url), and a short caller stack.
function wrapRegistrant(obj, name) {
  const orig = obj[name];
  if (typeof orig !== 'function') return;
  obj[name] = function wrappedRegistrant(first, ...rest) {
    try {
      return orig.call(this, first, ...rest);
    } catch (err) {
      try {
        const info = {
          method: name,
          firstArg: (typeof first === 'string') ? first : (first && first.name) || String(first),
          firstArgType: typeof first,
          message: err && err.message ? err.message : String(err),
        };
        console.error('[route-sanitize] Error registering route', JSON.stringify(info));
        // capture short stack and show where the call came from
        const stack = new Error().stack || '';
        const lines = stack.split('\n').slice(2, 14); // skip this function and show caller frames
        console.error('[route-sanitize] Caller stack:\n' + lines.join('\n'));
        // Also include the original error stack for path-to-regexp
        console.error('[route-sanitize] Original error stack:\n' + (err && err.stack ? err.stack : String(err)));
      } catch (logErr) {
        console.error('[route-sanitize] Failed to log registration error:', logErr && logErr.stack ? logErr.stack : String(logErr));
      }
      // Skip the failing registration so server can continue
      return this;
    }
  };
}

// wrap app-level methods
['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].forEach(m => wrapRegistrant(app, m));

// wrap router prototype so Router().use/register also gets wrapped
if (express && express.Router && express.Router.prototype) {
  const proto = express.Router.prototype;
  ['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].forEach(m => wrapRegistrant(proto, m));
}

// --- Connect to MongoDB (if provided) ---
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('? Connected to MongoDB'))
    .catch(err => console.error('? MongoDB connection error:', err && err.message ? err.message : err));
} else {
  console.warn('WARNING: MONGODB_URI not set. Database features will be disabled.');
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const allowed = [
    'https://toasttalent.co.za',
    'https://www.toasttalent.co.za',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ];
  const origin = req.get('origin');
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Serve static files
const staticDir = path.join(__dirname, 'public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('Serving static files from', staticDir);
}

// Health and API root
app.get('/health', (req, res) => res.json({ ok: true, timestamp: Date.now(), env: process.env.NODE_ENV || 'unknown' }));
app.get('/api', (req, res) => res.json({ message: 'API root' }));

// Mount models router (if present). Instrumentation will log if any router registers a bad route.
try {
  const modelsRouter = require('./routes/models');
  app.use('/api/models', modelsRouter);
  console.log('Mounted /api/models');
} catch (err) {
  console.warn('Could not mount /api/models:', err && err.message ? err.message : err);
}

// 404 for API
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(staticDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Not found');
});

// error logging
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err && err.stack ? err.stack : err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

// Start server
app.listen(port, () => console.log('Server running on port', port));
