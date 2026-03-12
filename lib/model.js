// lib/model.js
import mongoose from 'mongoose';

const MODEL_NAME = 'Model';
const allowedCategories = ['Women', 'Men', 'Kids', 'Influencers'];

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

    category: {
      type: String,
      enum: allowedCategories,
      default: 'Women',
    },

    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);

export default Model;