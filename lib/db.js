import mongoose from 'mongoose';

let isConnected = false;

export default async function dbConnect() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
}
