// lib/model.js
import mongoose from 'mongoose';

// Prevent model recompilation in dev/hot-reload
const MODEL_NAME = 'Model';

const allowedCategories = ['Women', 'Men', 'Kids'];

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
    category: {
      type: String,
      enum: allowedCategories,
      required: true, // ensure something is always set
      validate: {
        validator: v => allowedCategories.includes(v),
        message: props => `${props.value} is not a valid category`
      }
    },

    // images stored as Cloudinary URLs
    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Reuse existing model if it exists (avoids OverwriteModelError)
const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);

export default Model;