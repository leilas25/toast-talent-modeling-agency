import mongoose from 'mongoose';

const ModelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number },
  bio: { type: String, trim: true },
  images: { type: [String], default: [] },
  profilePicture: { type: String },
  galleryImages: { type: [String], default: [] },
  shoe: { type: String },
  shirt: { type: String },
  pants: { type: String },
  height: { type: String }
}, {
  timestamps: true
});

const Model = mongoose.models.Model || mongoose.model('Model', ModelSchema);

export default Model;
