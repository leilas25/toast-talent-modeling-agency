const ModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    age: { type: String },
    height: { type: String },
    shoe: { type: String },
    shirt: { type: String },
    pants: { type: String },
    bio: { type: String },
    category: {
      type: String,
      enum: ['Women', 'Men', 'Kids'],
      default: 'Women'
    },
    profilePicture: { type: String, required: true },
    galleryImages: [{ type: String }]
  },
  { timestamps: true }
);
