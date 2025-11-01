// lib/model.js
import mongoose from 'mongoose';

// Prevent model recompilation in dev/hot-reload
const MODEL_NAME = 'Model';

const schema = new mongoose.Schema(
  {
    // core identity
    name: { type: String, required: true, trim: true },
    surname: { type: String, trim: true },

    // attributes
    age: { type: String },
    height: { type: String },
    shoe: { type: String },
    shirt: { type: String },
    pants: { type: String },
    bio: { type: String },

    // category for filtering (Women/Men/Kids)
    category: { type: String, enum: ['Women', 'Men', 'Kids'], default: 'Women' },

    // images stored as Cloudinary URLs
    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Reuse existing model if it exists (avoids OverwriteModelError)
const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);

export default Model;
