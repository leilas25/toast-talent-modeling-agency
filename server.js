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
 * Allow exact origins and enable credentials for cross-site cookies.
 * Make sure your frontend origin(s) are in this list.
 */
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za'
];

app.use(cors({
  origin: function (origin, callback) {
    // `origin` will be undefined for same-origin requests like curl/postman,
    // allow those as well (useful for server-side jobs).
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
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
app.set('trust proxy', 1); // required when running behind proxies (Render, Vercel, etc.)

/**
 * ---------------- Environment checks ----------------
 */
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set. Please configure your environment variables.");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD is not set. Please configure your environment variables.");
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.warn("⚠️ SESSION_SECRET not set — using fallback. It's recommended to set SESSION_SECRET in env.");
}

/**
 * ---------------- MongoDB Connection ----------------
 */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

/**
 * ---------------- Session Setup (store in Mongo) ----------------
 * Important for cross-subdomain cookies:
 * - cookie.sameSite must be 'None' in production
 * - cookie.secure must be true in production (HTTPS)
 */
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions',
  ttl: 60 * 60 * 2 // 2 hours
});

app.use(session({
  name: 'connect.sid', // default name
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (HTTPS)
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
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
  profilePicture: String,   // Cloudinary URL or path
  galleryImages: [String]    // Array of URLs
});
const Model = mongoose.model('Model', modelSchema);

/**
 * ---------------- SendGrid (contact form) ----------------
 */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("⚠️  SENDGRID_API_KEY is not set. Contact form emails will not be sent.");
}

/**
 * ---------------- Auth helpers & routes ----------------
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// check auth - returns 200 if authenticated, 401 otherwise
app.get('/api/check-auth', (req, res) => {
  if (req.session?.isAdmin) {
    return res.json({ authenticated: true });
  }
  return res.status(401).json({ authenticated: false });
});

// login - set session and ensure cookie is saved
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    // call save to ensure session persisted before response (helps with immediate cookie send)
    req.session.save(err => {
      if (err) {
        console.error("Session save error on login:", err);
        return res.status(500).json({ success: false, error: 'Session save failed' });
      }
      return res.json({ success: true, message: 'Login successful' });
    });
    return;
  }
  return res.status(401).json({ success: false, error: 'Incorrect password' });
});

// logout - destroy session and clear cookie
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Error destroying session:", err);
      // still try to clear cookie
      res.clearCookie('connect.sid', { path: '/', sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', secure: process.env.NODE_ENV === 'production' });
      return res.status(500).json({ success: false, error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid', { path: '/', sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', secure: process.env.NODE_ENV === 'production' });
    return res.json({ success: true, message: 'Logged out' });
  });
});

/**
 * ---------------- Models API ----------------
 */
app.get('/api/models', async (req, res) => {
  try {
    const models = await Model.find().sort({ name: 1 });
    res.json(models);
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ error: 'Unable to fetch models' });
  }
});

app.get('/api/models/:id', async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    return res.json(model);
  } catch (err) {
    console.error("Error fetching model:", err);
    return res.status(500).json({ error: 'Unable to fetch model' });
  }
});

// Note: frontend uploads to Cloudinary and sends URLs in JSON body
app.post('/api/models', requireAdmin, async (req, res) => {
  try {
    const { name, age, shoe, shirt, pants, height, profilePicture, galleryImages } = req.body;
    if (!name || !profilePicture) {
      return res.status(400).json({ error: 'Name and profile picture are required' });
    }
    const newModel = new Model({
      name,
      age,
      shoe,
      shirt,
      pants,
      height,
      profilePicture,
      galleryImages: Array.isArray(galleryImages) ? galleryImages : []
    });
    await newModel.save();
    return res.status(201).json(newModel);
  } catch (err) {
    console.error("Error saving model:", err);
    return res.status(500).json({ error: 'Failed to save model', details: err.message });
  }
});

app.delete('/api/models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    await Model.deleteOne({ _id: req.params.id });
    return res.json({ success: true });
  } catch (err) {
    console.error("Error deleting model:", err);
    return res.status(500).json({ error: 'Failed to delete model' });
  }
});

/**
 * ---------------- Contact form endpoint ----------------
 * Expects JSON { name, email, message } from frontend.
 * Uses SendGrid if configured.
 */
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "All fields required" });

  if (!process.env.SENDGRID_API_KEY) {
    console.warn("Contact attempted but SENDGRID_API_KEY missing");
    return res.status(503).json({ error: "Email service not configured" });
  }

  const msg = {
    to: process.env.CONTACT_RECIPIENT || 'leila@toasttalent.co.za',
    from: process.env.SENDGRID_FROM || 'no-reply@toasttalent.co.za', // Must be verified in SendGrid
    replyTo: email,
    subject: `Contact form: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await sgMail.send(msg);
    return res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error("SendGrid error:", error.response?.body || error.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * ---------------- Simple health route ----------------
 */
app.get('/healthz', (req, res) => res.json({ ok: true }));

/**
 * ---------------- Start Server ----------------
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
