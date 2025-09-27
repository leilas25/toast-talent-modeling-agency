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

// ---------------- CORS ----------------
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'https://toasttalent.co.za',
  'https://www.toasttalent.co.za',
  'https://api.toasttalent.co.za'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for origin: ' + origin));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// ---------------- Middleware ----------------
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1); // needed for Render + secure cookies

// ---------------- Session Setup ----------------
const sessionStore = MongoStore.create({
  mongoUrl: process.env.MONGODB_URI,
  collectionName: 'sessions'
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // true in production for HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

// ---------------- Env Vars Check ----------------
if (!process.env.ADMIN_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD is not set.");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set.");
  process.exit(1);
}
if (!process.env.SENDGRID_API_KEY) {
  console.error("⚠️  SENDGRID_API_KEY is missing. Emails will not send.");
}

// ---------------- MongoDB Connection ----------------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ---------------- Models ----------------
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

// ---------------- Auth Routes ----------------
app.get('/api/check-auth', (req, res) => {
  if (req.session?.isAdmin) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true, message: "Login successful" });
  }
  res.status(401).json({ success: false, error: 'Incorrect password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: "Logged out" });
  });
});

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ---------------- Models API ----------------
app.get('/api/models', async (req, res) => {
  try {
    const models = await Model.find();
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
    res.json(model);
  } catch (err) {
    console.error("Error fetching model:", err);
    res.status(500).json({ error: 'Unable to fetch model' });
  }
});

app.post('/api/models', requireAdmin, async (req, res) => {
  try {
    const { name, age, shoe, shirt, pants, height, profilePicture, galleryImages } = req.body;
    if (!name || !profilePicture) {
      return res.status(400).json({ error: 'Name and profile picture are required' });
    }
    const newModel = new Model({ name, age, shoe, shirt, pants, height, profilePicture, galleryImages: galleryImages || [] });
    await newModel.save();
    res.status(201).json(newModel);
  } catch (err) {
    console.error("Error saving model:", err);
    res.status(500).json({ error: 'Failed to save model', details: err.message });
  }
});

app.delete('/api/models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    await Model.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting model:", err);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// ---------------- Contact Form ----------------
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const msg = {
    to: "leila@toasttalent.co.za",
    from: "leila@toasttalent.co.za", // Must be verified in SendGrid
    replyTo: email,
    subject: `New Contact Form Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await sgMail.send(msg);
    console.log("✅ Email sent successfully");
    res.status(200).json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("❌ Email send error:", error.response?.body || error.message);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
