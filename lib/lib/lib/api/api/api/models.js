// lib/model.js
import mongoose from 'mongoose';

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

    // Category: must be one of these, no default
    category: {
      type: String,
      enum: ['Women', 'Men', 'Kids', 'Influencers'],
      required: true
    },

    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Avoid recompiling in dev/hot reload
const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);

export default Model;