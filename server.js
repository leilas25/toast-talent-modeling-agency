'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Basic body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple CORS for your frontend domain (adjust if needed)
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
    // allow non-browser requests (curl, server-side)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Serve static files from ./public if present
const staticDir = path.join(__dirname, 'public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('Serving static files from', staticDir);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: Date.now(), env: process.env.NODE_ENV || 'unknown' });
});

// API root - intentionally minimal so server starts reliably
app.get('/api', (req, res) => {
  res.json({
    message: 'API root — backend modules are currently disabled to ensure server stability.',
    note: 'Enable modules individually after fixing missing dependencies and import paths.'
  });
});

/*
  NOTE about mounting existing lib/ modules:
  - Previously we attempted to require and mount many files under lib/ automatically, but some files
    had broken relative imports or required packages not yet installed (e.g. iron-session), causing the
    server to crash on startup. To keep Render deploys stable, this server intentionally does NOT
    auto-require those modules.

  - When you're ready to re-enable them, do this step-by-step:
    1) Fix any missing npm packages (npm install iron-session ...).
    2) Fix broken relative imports inside the modules (use path.join(__dirname, ...) or correct ../../ paths).
    3) Re-enable mounting for only the modules you have confirmed work (example helper below).

  Example safe mounting helper (uncomment and adapt when ready):
  ------------------------------------------------------------
  // const base = path.join(__dirname, 'lib');
  // function safeMount(filePath, mountPath) {
  //   try {
  //     const mod = require(filePath);
  //     if (mod && typeof mod === 'function' && Array.isArray(mod.stack)) {
  //       app.use(mountPath, mod);
  //       console.log('Mounted router', mountPath, '->', filePath);
  //     } else if (mod && mod.router && typeof mod.router === 'function' && Array.isArray(mod.router.stack)) {
  //       app.use(mountPath, mod.router);
  //       console.log('Mounted router (export.router)', mountPath, '->', filePath);
  //     } else {
  //       console.log('Skipping (not a router):', filePath);
  //     }
  //   } catch (err) {
  //     console.warn('Failed to require', filePath, '->', err && err.message);
  //   }
  // }
  // safeMount(path.join(base, 'api', 'api', 'api', 'models.js'), '/api/models'); // example
  ------------------------------------------------------------
*/

// Catch-all 404 for /api/*
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Optional SPA fallback for non-API routes: serve index.html if present
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const index = path.join(staticDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// Error handling and process-level logging
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