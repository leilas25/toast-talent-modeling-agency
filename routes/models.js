import express from 'express';
import dbConnect from '../lib/db.js';
import Model from '../lib/model.js';

const router = express.Router();

/* Connect to DB once */
let connected = false;
async function ensureDb() {
  if (!connected) {
    await dbConnect();
    connected = true;
  }
}

/* GET /api/models */
router.get('/', async (req, res) => {
  try {
    await ensureDb();
    const models = await Model.find().sort({ name: 1, surname: 1 });
    return res.json(models);
  } catch (err) {
    console.error('Error fetching models', err);
    return res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/* POST /api/models  (expects JSON with Cloudinary URLs) */
router.post('/', async (req, res) => {
  try {
    await ensureDb();
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      surname,
      age,
      height,
      shoe,
      shirt,
      pants,
      bio,
      profilePicture,     // string URL from Cloudinary
      galleryImages = []  // array of Cloudinary URLs
    } = req.body || {};

    if (!name || !surname) {
      return res.status(400).json({ error: 'Name and surname are required' });
    }
    if (!profilePicture) {
      return res.status(400).json({ error: 'Profile picture is required' });
    }

    const doc = new Model({
      name,
      surname,
      age,
      height,
      shoe,
      shirt,
      pants,
      bio,
      profilePicture,
      galleryImages
    });

    await doc.save();
    return res.status(201).json(doc);
  } catch (err) {
    console.error('Error creating model', err);
    return res.status(500).json({ error: 'Failed to create model' });
  }
});

/* DELETE /api/models?id=<id> */
router.delete('/', async (req, res) => {
  try {
    await ensureDb();
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    await Model.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting model', err);
    return res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;
