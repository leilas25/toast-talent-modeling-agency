// lib/model.js
import mongoose from 'mongoose';

const MODEL_NAME = 'Model';
const allowedCategories = ['Women', 'Men', 'Kids'];

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

    // category for filtering (Women/Men/Kids)
    category: {
      type: String,
      enum: allowedCategories,
      default: 'Women', // fallback if nothing is sent
      validate: {
        validator: v => allowedCategories.includes(v),
        message: props => `${props.value} is not a valid category`
      }
    },

    profilePicture: { type: String },
    galleryImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

const Model = mongoose.models[MODEL_NAME] || mongoose.model(MODEL_NAME, schema);
export default Model;