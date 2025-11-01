import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';
import fs from 'fs';
import multer from 'multer';
import sgMail from '@sendgrid/mail';

import modelsRouter from './routes/models.js';

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

/* ------------ Trust proxy (needed for secure cookies on Render) ------------ */
app.set('trust proxy', 1);

/* ------------ Body parsing ------------ */
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

/* ------------ Cookies & session ------------ */
app.use(cookieParser());
app.use(session({
  name: process.env.SESSION_NAME || 'tt_session',
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    domain: IS_PROD ? (process.env.COOKIE_DOMAIN || '.toasttalent.co.za') : undefined,
    httpOnly: true,
    secure: IS_PROD,           // HTTPS only in prod
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

/* ------------ CORS (allow your sites) ------------ */
const allowedOrigins = [
  'https://toast-talent-modeling-agency.onrender.com',
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za',
  'http://localhost:10000',
  'http://localhost:3000'
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

/* ------------ Sanity / Health ------------ */
app.get('/api/models-sanity', (req, res) => {
  res.json({ sanity: true, commit: process.env.DEPLOY_COMMIT || 'local', env: NODE_ENV });
});
app.get('/health', (req, res) => res.json({ ok: true }));

/* ------------ Admin login (session-based) ------------ */
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // set in Render dashboard
  if (password && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true, message: 'Login successful' });
  }
  return res.status(401).json({ ok: false, message: 'Incorrect password' });
});

app.post('/api/admin-logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('tt_session');
    res.json({ ok: true });
  });
});

/* ------------ Models API ------------ */
app.use('/api/models', modelsRouter);

/* ------------ Apply (email to Zoho via SendGrid, with photo attachments) ------------ */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set. /api/apply and /api/book emails will fail.');
}

const upload = multer({ limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB/file

app.post(
  '/api/apply',
  upload.fields([
    { name: 'headshotNeutral', maxCount: 1 },
    { name: 'headshotSmiling', maxCount: 1 },
    { name: 'sideProfile',     maxCount: 1 },
    { name: 'halfBody',        maxCount: 1 },
    { name: 'fullBody',        maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const f = req.body || {};
      const toB64 = (file) => ({
        content: file.buffer.toString('base64'),
        filename: file.originalname,
        type: file.mimetype,
        disposition: 'attachment',
      });

      const files = req.files || {};
      const attachments = []
        .concat(files.headshotNeutral || [])
        .concat(files.headshotSmiling || [])
        .concat(files.sideProfile || [])
        .concat(files.halfBody || [])
        .concat(files.fullBody || [])
        .map(toB64);

      const lines = [
        'New Model Application',
        '',
        `Name: ${f.firstName || ''} ${f.lastName || ''}`,
        `Email: ${f.email || ''}`,
        `Phone: ${f.phone || ''}`,
        `DOB: ${f.dob || ''}`,
        `Gender: ${f.gender || ''}`,
        '',
        'Measurements:',
        `Height: ${f.height || ''}`,
        `Bust: ${f.bust || ''}`,
        `Hips: ${f.hips || ''}`,
        `Waist: ${f.waist || ''}`,
        `Dress Size: ${f.dressSize || ''}`,
        `Shirt Size: ${f.shirtSize || ''}`,
        `Shoe Size: ${f.shoeSize || ''}`,
        `Hair: ${f.hairColor || ''}`,
        `Eyes: ${f.eyeColor || ''}`,
        '',
        'Location:',
        `Address: ${f.address || ''}`,
        `City: ${f.city || ''}`,
        `Province: ${f.province || ''}`,
        `Zip: ${f.zip || ''}`,
        '',
        `Message: ${f.message || ''}`,
      ];

      await sgMail.send({
        to: 'leila@toasttalent.co.za',
        from: 'leila@toasttalent.co.za', // must be verified in SendGrid
        subject: `New Application — ${f.firstName || ''} ${f.lastName || ''}`,
        text: lines.join('\n'),
        attachments
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ Apply email failed:', err.response?.body || err);
      res.status(500).json({ error: 'Failed to send application' });
    }
  }
);

/* ------------ Booking Email Endpoint ------------ */
app.post('/api/book', async (req, res) => {
  try {
    const { modelId, modelName, requesterEmail, requesterWhatsapp } = req.body || {};
    if (!modelName || !requesterEmail || !requesterWhatsapp) {
      return res.status(400).json({ error: 'modelName, requesterEmail and requesterWhatsapp are required' });
    }
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const to = process.env.BOOK_TO_EMAIL || 'leila@toasttalent.co.za';
    const from = process.env.BOOK_FROM_EMAIL || 'leila@toasttalent.co.za';

    const msg = {
      to,
      from,
      subject: `Booking Request — ${modelName}`,
      text:
`A new booking request has been submitted.

Model: ${modelName}
Model ID (if provided): ${modelId || '-'}

Requester Email: ${requesterEmail}
Requester WhatsApp: ${requesterWhatsapp}

Please follow up with the requester to confirm details.`,
    };

    await sgMail.send(msg);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Booking email error:', err?.response?.body || err.message || err);
    return res.status(500).json({ error: 'Failed to send booking email' });
  }
});

/* ------------ Static assets ------------ */
try {
  app.use(express.static(path.join(__dirname, 'public')));
  console.log('✅ Static middleware mounted.');
} catch (e) {
  console.error('⚠️ Failed to mount static middleware (non-fatal):', e);
}

/* ------------ SPA fallback (safe) ------------ */
app.use((req, res, next) => {
  try {
    if (req.method !== 'GET') return next();
    if (req.path && req.path.startsWith('/api/')) return next();

    const candidate = path.join(__dirname, 'public', decodeURIComponent(req.path.replace(/^\//, '')));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next();

    const indexFile = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile, err => {
        if (err) {
          console.error('Error sending index.html fallback:', err);
          return next();
        }
      });
    }
    next();
  } catch (err) {
    console.error('Error in SPA fallback middleware:', err);
    next();
  }
});

/* ------------ Start server ------------ */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${NODE_ENV})`);
});
