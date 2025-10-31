import mongoose from 'mongoose';

const { MONGODB_URI } = process.env;

let cached = global._mongooseConn;
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (!MONGODB_URI) {
    throw new Error('❌ MONGODB_URI is not set');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      // Options are optional on Mongoose 7+, kept minimal
    }).then((m) => m.connection);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
