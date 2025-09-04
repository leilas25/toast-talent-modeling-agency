const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const fs = require('fs');

const app = express();

// --- CORS: Enable credentials and set frontend origin ---
app.use(cors({
  origin: 'https://toast-talent-modeling-agency.onrender.com', // your frontend domain
  credentials: true
}));

app.use(bodyParser.json());

// --- Ensure static files are served (MUST be before routes) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- TRUST PROXY IS REQUIRED FOR RENDER HTTPS ---
app.set('trust proxy', 1);

// --- SESSION STORE SETUP ---
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  // In production, you should use a robust session store (e.g., MongoStore, Redis)
  // Example (uncomment and install connect-mongo):
  // const MongoStore = require('connect-mongo');
  // sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI });
  // For now, fallback to MemoryStore with warning (don't use for real production!)
  console.warn("⚠️ Using MemoryStore for session in production! Consider using MongoStore or Redis.");
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'LeilaSono123!',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: true,      // true for HTTPS (Render uses HTTPS)
    sameSite: 'none',  // Required for cross-origin cookies
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Yumnagugu1980";

// --- MONGOOSE CONNECTION ---
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// --- MODEL SCHEMA ---
const modelSchema = new mongoose.Schema({
  name: String,
  age: String,
  shoe: String,
  shirt: String,
  pants: String,
  height: String,
  images: [String]
});
const Model = mongoose.model('Model', modelSchema);

// --- Ensure "public/images" exists ---
const imageDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

// --- MULTER STORAGE ---
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, imageDir);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const finalName = basename + '-' + Date.now() + ext;
    cb(null, finalName);
  }
});
const upload = multer({ storage: storage });

// --- LOGIN ROUTE ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Incorrect password' });
});

// --- LOGOUT ROUTE ---
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// --- REQUIRE ADMIN MIDDLEWARE ---
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- GET MODELS ---
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
app.post('/api/models', requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    console.log("REQ FILES:", req.files);
    const { name, age, shoe, shirt, pants, height } = req.body;
    const images = req.files ? req.files.map(f => '/images/' + f.filename) : [];
    if (!name || images.length === 0) {
      return res.status(400).json({ error: 'Name and at least one image required' });
    }
    // Log actual image paths for debugging
    console.log("Saved image URLs:", images);
    const newModel = new Model({ name, age, shoe, shirt, pants, height, images });
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
    if (Array.isArray(model.images)) {
      model.images.forEach(img => {
        const imgPath = path.join(imageDir, path.basename(img));
        fs.unlink(imgPath, () => {});
      });
    }
    await Model.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting model:", err);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// --- TEST SESSION PERSISTENCE ---
app.get('/api/test-cookie', (req, res) => {
  if (req.session.test) {
    res.json({ success: true, msg: "Session persists!" });
  } else {
    req.session.test = true;
    res.json({ success: false, msg: "Session set, reload again!" });
  }
});

// --- PORT BINDING FOR RENDER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));