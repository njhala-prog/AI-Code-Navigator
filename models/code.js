const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema({
  fileName: String,
  filePath: String,
  code: String,
  summary: String,
  embedding: [Number],
});

module.exports = mongoose.model('Code', codeSchema);