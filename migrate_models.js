const fs = require('fs').promises;
const mongoose = require('mongoose');
const path = require('path');

const MODELS_FILE = path.join(__dirname, 'models.json');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Set MONGODB_URI before running this script');
    process.exit(1);
  }
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const content = await fs.readFile(MODELS_FILE, 'utf8').catch(() => '[]');
  const models = JSON.parse(content || '[]');

  if (!models.length) {
    console.log('No records found in models.json');
    process.exit(0);
  }

  const ModelSchema = new mongoose.Schema({}, { strict: false });
  const Model = mongoose.model('Model_migration', ModelSchema, 'models');

  const inserted = await Model.insertMany(models);
  console.log(`Inserted ${inserted.length} records`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
