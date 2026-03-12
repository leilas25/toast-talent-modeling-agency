// lib/model.js (replace both old files with this)
import mongoose from 'mongoose';

// Prevent recompilation in dev/hot-reload
const MODEL_NAME = 'Model';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, trim: true },
    age: { type: String },
    height: { type: String },
    shoe: { type: String },
    shirt: { type: String },
    pants: { type: String },
    bio: { type: String },

    // Fixed category
    category: {
      type: String,
      enum: ['Women', 'Men', 'Kids', 'Influencers'], // allow all categories
      required: true // force selection
    },

    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Reuse model if exists
const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);

export default Model;