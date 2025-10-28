import express from 'express';
import dbConnect from '../lib/db.js';
import Model from '../lib/model.js';

const router = express.Router();

// Connect to DB on first use
let connected = false;
async function ensureDb() {
  if (!connected) {
    await dbConnect();
    connected = true;
  }
}

// GET /api/models
router.get('/', async (req, res) => {
  try {
    await ensureDb();
    const models = await Model.find().sort({ name: 1 });
    return res.json(models);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error fetching models', err);
    return res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST /api/models  (requires admin session)
router.post('/', async (req, res) => {
  try {
    await ensureDb();
    if (!req.session?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body || {};
    // Basic safety: require at least a name
    if (!payload.name || typeof payload.name !== 'string') {
      return res.status(400).json({ error: 'Missing model name' });
    }

    const m = new Model(payload);
    await m.save();
    return res.status(201).json(m);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error creating model', err);
    return res.status(500).json({ error: 'Failed to create model' });
  }
});

// DELETE /api/models?id=<id>  (requires admin)
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
    // eslint-disable-next-line no-console
    console.error('Error deleting model', err);
    return res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;