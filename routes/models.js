const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Define a simple Model schema — adjust fields to match your frontend
const ModelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  bio: String,
  images: [String],
  createdAt: { type: Date, default: Date.now }
});

const Model = mongoose.models.Model || mongoose.model('Model', ModelSchema);

// GET /api/models  — list models
router.get('/', async (req, res) => {
  try {
    const results = await Model.find().sort({ createdAt: -1 }).lean();
    res.json(results);
  } catch (err) {
    console.error('GET /api/models error:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// POST /api/models — create a model
router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.name) return res.status(400).json({ error: 'missing_name' });

    const rec = new Model(payload);
    await rec.save();
    res.status(201).json(rec);
  } catch (err) {
    console.error('POST /api/models error:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

module.exports = router;
