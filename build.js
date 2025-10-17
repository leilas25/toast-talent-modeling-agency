// build.js
// Copies your static site files into the `dist/` folder for Vercel to serve.

const fs = require('fs').promises;
const path = require('path');

const OUT = path.join(__dirname, 'dist');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
  await ensureDir(destDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const destPath = path.join(destDir, e.name);
    if (e.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (e.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  // Clean output
  try { await fs.rm(OUT, { recursive: true, force: true }); } catch(e){}

  // Files to copy if they exist
  const files = [
    'index.html',
    'about.html',
    'models.html',
    'profile.html',
    'contact.html',
    'admin.html',
    'style.css',
    'models.json',
    'robots.txt',
    'sitemap.xml'
  ];

  // Directories to copy if present
  const dirs = [
    'images',
    'public'
  ];

  await ensureDir(OUT);

  for (const f of files) {
    const src = path.join(__dirname, f);
    if (await exists(src)) {
      await copyFile(src, path.join(OUT, f));
      console.log('Copied file:', f);
    }
  }

  for (const d of dirs) {
    const src = path.join(__dirname, d);
    if (await exists(src)) {
      await copyDir(src, path.join(OUT, d));
      console.log('Copied dir:', d);
    }
  }

  console.log('Build complete — output in', OUT);
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exitCode = 1;
});