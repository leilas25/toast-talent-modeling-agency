'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// --- Connect to MongoDB ---
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.warn('WARNING: MONGODB_URI not set. Database features will be disabled.');
} else {
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err && err.message ? err.message : err));
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic CORS (adjust allowed origins as needed)
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
    // allow server-to-server (curl) requests
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

// Mount models router (if present)
try {
  const modelsRouter = require('./routes/models');
  // mount the router at /https://api.toasttalent.co.za/api/models
  app.use('/https://api.toasttalent.co.za/api/models', modelsRouter);
  console.log('Mounted /https://api.toasttalent.co.za/api/models');
} catch (err) {
  console.warn('Could not mount /https://api.toasttalent.co.za/api/models:', err && err.message ? err.message : err);
}

// --- Safe API 404 handler (replaces app.use('/api/*', ...)) ---
// If a request starts with /api and no earlier route handled it, return 404 JSON.
// This avoids passing a wildcard pattern into Express's route parser.
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  next();
});

// --- SPA fallback (replaces app.get('*', ...)) ---
// Serve index.html for non-API routes if present, otherwise continue to next handler.
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api')) return next();
  const index = path.join(staticDir, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// error logging
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err && err.stack ? err.stack : err));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

// Start server
app.listen(port, () => console.log('Server running on port', port));
