import mongoose from 'mongoose';

const ModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    age: { type: String },         // keep as String to match your previous data
    height: { type: String },
    shoe: { type: String },
    shirt: { type: String },
    pants: { type: String },
    bio: { type: String },

    // Cloudinary
    profilePicture: { type: String, required: true },
    galleryImages: [{ type: String }]
  },
  { timestamps: true }
);

// Avoid model overwrite in dev/hot reload:
export default mongoose.models.Model || mongoose.model('Model', ModelSchema);
