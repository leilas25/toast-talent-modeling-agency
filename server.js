require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');

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
  secret: process.env.SESSION_SECRET || 'LeilaSono123!',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Yumnagugu1980";

// --- MONGOOSE CONNECTION ---
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set. Please check your Render environment variables.");
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
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
  profilePicture: String,   // Cloudinary URL
  galleryImages: [String]   // Array of Cloudinary URLs
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

// --- ADD MODEL (frontend already uploads to Cloudinary) ---
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
      profilePicture,  // Cloudinary URL from frontend
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

// --- PORT ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
