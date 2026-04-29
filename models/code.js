const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  fileName: String,
  filePath: String,
  code: String,
  summary: String,
  embedding: [Number],
  contentHash: { type: String, unique: true, sparse: true },
});

module.exports = mongoose.model('Code', codeSchema);