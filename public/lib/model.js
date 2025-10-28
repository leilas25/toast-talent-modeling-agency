import mongoose from 'mongoose';

const ModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number },
  bio: { type: String, trim: true },
  images: { type: [String], default: [] },         // simple array of image URLs
  profilePicture: { type: String },                // optional main picture
  galleryImages: { type: [String], default: [] },  // alias for gallery
  shoe: { type: String },
  shirt: { type: String },
  pants: { type: String },
  height: { type: String }
}, {
  timestamps: true
});

// When using ESM, mongoose keeps created models on the global registered models map.
// This line ensures we don't register the model twice when hot-reloading or across multiple imports.
const Model = mongoose.models.Model || mongoose.model('Model', ModelSchema);

export default Model;