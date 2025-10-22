'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static site if present
const staticDir = path.join(__dirname, 'public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
}

// Health endpoint
app.get('/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'unknown' }));

// Helper: attempt to mount any Express routers found under lib/
// This is best-effort and will not crash if a module has other dependencies.
(function mountLibRouters() {
  const base = path.join(__dirname, 'lib');
  if (!fs.existsSync(base)) return;

  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && name.endsWith('.js')) {
        try {
          const mod = require(full);
          // If module exports an Express Router directly
          if (mod && typeof mod === 'function' && Array.isArray(mod.stack)) {
            const rel = path.relative(base, full).replace(/\\/g, '/').replace(/\.js$/, '');
            const routePath = '/api/' + rel;
            app.use(routePath, mod);
            console.log('Mounted router', routePath, '->', full);
          } else if (mod && mod.router && typeof mod.router === 'function' && Array.isArray(mod.router.stack)) {
            const rel = path.relative(base, full).replace(/\\/g, '/').replace(/\.js$/, '');
            const routePath = '/api/' + rel;
            app.use(routePath, mod.router);
            console.log('Mounted router (export.router)', routePath, '->', full);
          } else {
            // Not a router export — skip
          }
        } catch (err) {
          // Skip modules that require other setup; log a short warning so you can inspect
          console.warn('Skipping', full, '->', err && err.message ? err.message : String(err));
        }
      }
    }
  }

  try { walk(base); } catch (err) { console.warn('Router loader error:', err && err.message); }
})();

// Basic API root
app.get('/api', (req, res) => {
  res.json({ message: 'API root — available endpoints depend on mounted routers', timestamp: Date.now() });
});

// Catch-all 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Start server
app.listen(port, () => {
  console.log('Server running on port', port);
});