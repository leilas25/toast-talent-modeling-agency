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

// Mount models router (created below)
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