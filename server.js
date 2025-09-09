const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();

// --- CORS: Enable credentials and set frontend origin ---
app.use(cors({
  origin: 'https://toast-talent-modeling-agency.onrender.com', // your frontend domain
  credentials: true
}));

app.use(bodyParser.json());

// --- Serve static frontend ---
app.use(express.static(path.join(__dirname, 'public')));

// --- TRUST PROXY FOR RENDER HTTPS ---
app.set('trust proxy', 1);

// --- SESSION SETUP ---
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  console.warn("⚠️ Using MemoryStore for session in production! Consider using MongoStore or Redis.");
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'LeilaSono123!',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 2
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
  profilePicture: String,   // Cloudinary URL
  galleryImages: [String]   // Array of Cloudinary URLs
});
const Model = mongoose.model('Model', modelSchema);

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dk1df1qmi",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- MULTER STORAGE USING CLOUDINARY ---
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: "models",
    resource_type: "image",
    public_id: file.fieldname + "-" + Date.now(),
  }),
});
const upload = multer({ storage: storage });

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
app.post('/api/models', requireAdmin, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'galleryImages', maxCount: 20 }
]), async (req, res) => {
  try {
    const { name, age, shoe, shirt, pants, height } = req.body;

    const profilePictureUrl = req.files['profilePicture']
      ? req.files['profilePicture'][0].path
      : null;

    const galleryImageUrls = req.files['galleryImages']
      ? req.files['galleryImages'].map(f => f.path)
      : [];

    if (!name || !profilePictureUrl) {
      return res.status(400).json({ error: 'Name and a profile picture are required' });
    }

    const newModel = new Model({
      name,
      age,
      shoe,
      shirt,
      pants,
      height,
      profilePicture: profilePictureUrl,
      galleryImages: galleryImageUrls
    });

    await newModel.save();
    res.status(201).json(newModel);
  } catch (err) {
    console.error("Error saving model:", err);
    res.status(500).json({ error: 'Failed to save model', details: err.message });
  }
});

// --- DELETE MODEL (DB + CLOUDINARY) ---
app.delete('/api/models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    // Delete profile picture from Cloudinary
    if (model.profilePicture) {
      try {
        const publicId = model.profilePicture.split('/').slice(-1)[0].split('.')[0];
        await cloudinary.uploader.destroy("models/" + publicId);
      } catch (err) {
        console.warn("Could not delete profile picture from Cloudinary:", err.message);
      }
    }

    // Delete gallery images from Cloudinary
    if (Array.isArray(model.galleryImages)) {
      for (const url of model.galleryImages) {
        try {
          const publicId = url.split('/').slice(-1)[0].split('.')[0];
          await cloudinary.uploader.destroy("models/" + publicId);
        } catch (err) {
          console.warn("Could not delete gallery image:", err.message);
        }
      }
    }

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
