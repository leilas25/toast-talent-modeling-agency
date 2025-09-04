const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();

// --- CORS: Enable credentials and set frontend origin ---
app.use(cors({
  origin: 'https://toast-talent-modeling-agency.onrender.com', // your frontend domain
  credentials: true
}));

app.use(bodyParser.json());
app.use(express.static('public'));

// --- TRUST PROXY IS REQUIRED FOR RENDER HTTPS ---
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'LeilaSono123!',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,      // true for HTTPS (Render uses HTTPS)
    sameSite: 'none'   // Required for cross-origin cookies
  }
}));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Yumnagugu1980";

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

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

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/images/');
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage: storage });

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Incorrect password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/models', async (req, res) => {
  try {
    const models = await Model.find();
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch models' });
  }
});

app.post('/api/models', requireAdmin, upload.array('images', 6), async (req, res) => {
  const { name, age, shoe, shirt, pants, height } = req.body;
  const images = req.files ? req.files.map(f => '/images/' + f.filename) : [];
  if (!name || images.length === 0) {
    return res.status(400).json({ error: 'Name and at least one image required' });
  }
  try {
    const newModel = new Model({ name, age, shoe, shirt, pants, height, images });
    await newModel.save();
    res.status(201).json(newModel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save model' });
  }
});

app.delete('/api/models/:id', requireAdmin, async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    if (Array.isArray(model.images)) {
      const fs = require('fs');
      model.images.forEach(img => {
        const imgPath = path.join(__dirname, 'public', img);
        fs.unlink(imgPath, () => {});
      });
    }
    await Model.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// --- Test cookie/session persistence ---
app.get('/api/test-cookie', (req, res) => {
  if (req.session.test) {
    res.json({ success: true, msg: "Session persists!" });
  } else {
    req.session.test = true;
    res.json({ success: false, msg: "Session set, reload again!" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));