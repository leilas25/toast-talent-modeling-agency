require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const sgMail = require('@sendgrid/mail'); // <-- Using SendGrid now

const app = express();

// --- CORS ---
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://localhost:3000',
    'https://toast-talent-modeling-agency.onrender.com'
  ],
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

// --- SESSION SETUP ---
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

// --- ADMIN PASSWORD ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error("❌ ADMIN_PASSWORD is not set. Please configure it in your environment variables.");
  process.exit(1);
}

// --- MONGOOSE CONNECTION ---
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set. Please check your Render environment variables.");
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- MODEL SCHEMA ---
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

// --- AUTH CHECK ---
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// --- LOGIN ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Incorrect password' });
});

// --- LOGOUT ---
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// --- REQUIRE ADMIN ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- GET ALL MODELS ---
app.get('/api/models', async (req, res) => {
  try {
    const models = await Model.find();
    res.json(models);
  } catch (err) {
    console.error("Error fetching models:", err);
    res.status(500).json({ error: 'Unable to fetch models' });
  }
});

// --- GET SINGLE MODEL ---
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

// --- ADD MODEL ---
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
      galleryImages: galleryImages || []
    });

    await newModel.save();
    res.status(201).json(newModel);
  } catch (err) {
    console.error("Error saving model:", err);
    res.status(500).json({ error: 'Failed to save model', details: err.message });
  }
});

// --- DELETE MODEL ---
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

// --- TEST SESSION ---
app.get('/api/test-cookie', (req, res) => {
  if (req.session.test) {
    res.json({ success: true, msg: "Session persists!" });
  } else {
    req.session.test = true;
    res.json({ success: false, msg: "Session set, reload again!" });
  }
});

// --- CONTACT FORM WITH SENDGRID ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const msg = {
    to: process.env.TO_EMAIL,
    from: process.env.TO_EMAIL, // Must be verified in SendGrid
    subject: `New Contact Form Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    const response = await sgMail.send(msg);
    console.log("✅ Email sent successfully:", response);
    res.status(200).json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("❌ SendGrid Error:", error.response?.body || error.message);
    res.status(500).json({ error: "Failed to send email", details: error.response?.body || error.message });
  }
});

// --- PORT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
