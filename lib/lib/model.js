import mongoose from 'mongoose';

const modelSchema = new mongoose.Schema({
  name: String,
  age: String,
  shoe: String,
  shirt: String,
  pants: String,
  height: String,
  profilePicture: String,
  galleryImages: [String]
});

export default mongoose.models.Model || mongoose.model('Model', modelSchema);
