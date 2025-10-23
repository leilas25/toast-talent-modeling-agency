'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- Helper: sanitize mount paths that are full URLs and log stack traces to find caller ---
function sanitizeMountArg(arg) {
  if (typeof arg !== 'string') return arg;
  if (/^https?:\/\//i.test(arg)) {
    try {
      const u = new URL(arg);
      const pathname = u.pathname || '/';
      // capture stack to show who called app.use(...) with a full URL
      const stack = new Error().stack || '';
      console.warn(`[route-sanitize] Detected full-URL mount: "${arg}" -> sanitize to "${pathname}"`);
      console.warn('[route-sanitize] Caller stack:\n' + stack.split('\n').slice(2, 12).join('\n'));
      return pathname;
    } catch (err) {
      const stack = new Error().stack || '';
      console.warn(`[route-sanitize] Invalid mount URL detected and skipped: "${arg}"`);
      console.warn('[route-sanitize] Caller stack:\n' + stack.split('\n').slice(2, 12).join('\n'));
      return null; // signal to caller to skip the mount
    }
  }
  return arg;
}

function wrapAppMethod(obj, name) {
  const orig = obj[name];
  if (typeof orig !== 'function') return;
  obj[name] = function firstArgSanitizer(first, ...rest) {
    // If first arg is a string and a full URL, convert it to pathname or skip
    if (typeof first === 'string' && /^https?:\/\//i.test(first)) {
      const sanitized = sanitizeMountArg(first);
      if (sanitized === null) {
        // skip mount entirely and return this for chaining
        console.warn(`[route-sanitize] Skipped ${name} mount with invalid URL: ${first}`);
        return this;
      }
      console.log(`[route-sanitize] Converted ${name} mount URL -> path: "${first}" -> "${sanitized}"`);
      return orig.call(this, sanitized, ...rest);
    }
    return orig.call(this, first, ...rest);
  };
}

// Wrap app-level methods
['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].forEach(m => wrapAppMethod(app, m));

// Wrap router-level methods so Router().use(...) is also sanitized
if (express && express.Router && express.Router.prototype) {
  const proto = express.Router.prototype;
  ['use', 'get', 'post', 'put', 'patch', 'delete', 'all'].forEach(m => wrapAppMethod(proto, m));
}

// --- Basic middleware and CORS ---
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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Serve static files if present
const staticDir = path.join(__dirname, 'public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('Serving static files from', staticDir);
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now(), env: process.env.NODE_ENV || 'unknown' });
});

// Minimal API root
app.get('/api', (req, res) => {
  res.json({
    message: 'API root — backend modules are currently disabled by default for safety.',
    note: 'After we find offending mounts we can enable modules step-by-step.'
  });
});

// 404 for /api/*
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(staticDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// error logging
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Start server
app.listen(port, () => {
  console.log('Server running on port', port);
});