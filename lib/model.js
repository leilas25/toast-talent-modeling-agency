const schema = new mongoose.Schema({
  name: String,
  surname: String,
  age: String,
  height: String,
  shoe: String,
  shirt: String,
  pants: String,
  bio: String,
  profilePicture: String,
  galleryImages: [String]
});
