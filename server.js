// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const sgMail = require('@sendgrid/mail');

const app = express();

/**
 * ---------------- CORS ----------------
 * Include ALL frontend domains here
 */
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za',
  'https://toast-talent-modeling-agency.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed for origin: ' + origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
  exposedHeaders: ['Set-Cookie']
}));

/**
 * ---------------- Middleware ----------------
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1); // Important for HTTPS cookies behind proxies

/**
 * ---------------- Environment checks ----------------
 */
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD is not set.");
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.warn("⚠️ SESSION_SECRET not set — using fallback secret.");
}

/**
 * ---------------- MongoDB Connection ----------------
 */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

/**
 * ---------------- Session Setup ----------------
 * Secure cookies only in production
 * No maxAge → Session cookie (ends when browser closes)
 */
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions',
  ttl: 60 * 60 * 2 // 2 hours cleanup in DB
});

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'None' : 'Lax' // Allow cross-site cookies when needed
    // no maxAge → session cookie
  }
}));

/**
 * ---------------- Models ----------------
 */
const modelSchema = new mongoose.Schema({
  name: String,
  age: String,
  shoe: String,
  shirt: String,
  pants: String,
  height: String,
  profilePicture: String,
  galleryImages: [String]
});
const Model = mongoose.model('Model', modelSchema);

/**
 * ---------------- SendGrid ----------------
 */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("⚠️ SENDGRID_API_KEY not set. Emails will not be sent.");
}

/**
 * ---------------- Auth Routes ----------------
 */
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/check-auth', (req, res) => {
  return res.json({ authenticated: !!req.session?.isAdmin });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.save(err => {
      if (err) return res.status(500).json({ success: false, error: 'Session save failed' });
      return res.json({ success: true, message: 'Login successful' });
    });
    return;
  }
  return res.status(401).json({ success: false, error: 'Incorrect password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('connect.sid', {
      path: '/',
      sameSite: isProduction ? 'None' : 'Lax',
      secure: isProduction
    });
    if (err) return res.status(500).json({ success: false, error: 'Failed to logout' });
    return res.json({ success: true, message: 'Logged out' });
  });
});

/**
 * ---------------- Models API ----------------
 */
app.get('/api/models', async (req, res) => {
  try {
    const models = await Model.find().sort({ name: 1 });
    return res.json(models);
  } catch (err) {
    return res.status(500).json({ error: 'Unable to fetch models' });
  }
});

app.get('/api/models/:id', async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    return res.json(model);
  } catch {
    return res.status(500).json({ error: 'Unable to fetch model' });
  }
});

app.post('/api/models', requireAdmin, async (req, res) => {
  try {
    const { name, age, shoe, shirt, pants, height, profilePicture, galleryImages } = req.body;
    if (!name || !profilePicture) return res.status(400).json({ error: 'Name and profile picture are required' });
    const newModel = new Model({ name, age, shoe, shirt, pants, height, profilePicture, galleryImages: galleryImages || [] });
    await newModel.save();
    return res.status(201).json(newModel);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save model', details: err.message });
  }
});

app.delete('/api/models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    await Model.deleteOne({ _id: req.params.id });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete model' });
  }
});

/**
 * ---------------- Contact Form ----------------
 */
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required' });

  if (!process.env.SENDGRID_API_KEY) {
    return res.status(503).json({ error: 'Email service not configured' });
  }

  const msg = {
    to: process.env.CONTACT_RECIPIENT || 'leila@toasttalent.co.za',
    from: process.env.SENDGRID_FROM || 'no-reply@toasttalent.co.za',
    replyTo: email,
    subject: `Contact form: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await sgMail.send(msg);
    return res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * ---------------- Health Check ----------------
 */
app.get('/healthz', (req, res) => res.json({ ok: true }));

/**
 * ---------------- Start Server ----------------
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
