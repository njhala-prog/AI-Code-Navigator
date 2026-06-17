const mongoose = require('mongoose');

const codeSchema = new mongoose.Schema(
    {
        fileName: { type: String, required: true, index: true },
        filePath: String,
        code: { type: String, required: true },
        summary: String,
        embedding: [Number],
        contentHash: { type: String, unique: true, sparse: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Code', codeSchema);
