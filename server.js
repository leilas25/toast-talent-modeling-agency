const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// --- NEW CODE ---
const session = require('express-session');
// ---

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- NEW CODE ---
app.use(session({
  secret: 'supersecretkey', // CHANGE THIS to a random string!
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // true if using HTTPS, set to true
}));

const ADMIN_PASSWORD = "Yumnagugu1980"; // CHANGE this password!
// ---

const MODELS_FILE = './models.json';

// Setup multer for multiple image uploads
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

// Helper to safely read models.json
function safeReadModelsFile(callback) {
  fs.readFile(MODELS_FILE, (err, data) => {
    if (err) {
      // If file doesn't exist or can't be read, return empty array
      return callback([]);
    }
    try {
      const models = JSON.parse(data);
      // Ensure every model has an images array
      callback(Array.isArray(models) ? models.map(m => ({
        ...m,
        images: Array.isArray(m.images) ? m.images : []
      })) : []);
    } catch (e) {
      // If JSON corrupted, return empty array
      console.error("Error parsing models.json:", e);
      callback([]);
    }
  });
}

// --- NEW CODE ---
// Login endpoint
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Incorrect password' });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
// ---

// Get all models
app.get('/api/models', (req, res) => {
  safeReadModelsFile(models => res.json(models));
});

// --- NEW CODE ---
// Protect add and delete model endpoints
app.post('/api/models', requireAdmin, upload.array('images', 6), (req, res) => {
  const { name, age, shoe, shirt, pants, height } = req.body;
  const images = req.files ? req.files.map(f => '/images/' + f.filename) : [];
  if (!name || images.length === 0) {
    return res.status(400).json({ error: 'Name and at least one image required' });
  }

  safeReadModelsFile(models => {
    const newModel = {
      id: Date.now().toString(),
      name,
      age,
      shoe,
      shirt,
      pants,
      height,
      images: images // Always an array
    };
    models.push(newModel);
    fs.writeFile(MODELS_FILE, JSON.stringify(models, null, 2), err => {
      if (err) {
        console.error("Failed to save model:", err);
        return res.status(500).json({ error: 'Failed to save model' });
      }
      res.status(201).json(newModel);
    });
  });
});

app.delete('/api/models/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  safeReadModelsFile(models => {
    const model = models.find(m => m.id === id);
    if (model && Array.isArray(model.images)) {
      model.images.forEach(img => fs.unlink('public' + img, () => {}));
    }
    const filteredModels = models.filter(m => m.id !== id);
    fs.writeFile(MODELS_FILE, JSON.stringify(filteredModels, null, 2), err => {
      if (err) {
        console.error("Failed to delete model:", err);
        return res.status(500).json({ error: 'Failed to delete model' });
      }
      res.json({ success: true });
    });
  });
});
// ---

app.listen(3000, () => console.log('Server running on http://localhost:3000'));