const mongoose = require('mongoose');

const HeaderCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    present: { type: Boolean, required: true },
    value: { type: String, default: null },
    severity: { type: String, enum: ['high', 'medium', 'low'], required: true },
    recommendation: { type: String, required: true },
  },
  { _id: false }
);

const ScanSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    statusCode: { type: Number },
    score: { type: Number, required: true }, // 0-100
    grade: { type: String, required: true }, // A-F
    checks: { type: [HeaderCheckSchema], required: true },
    scannedAt: { type: Date, default: Date.now },
    error: { type: String, default: null },
    aiSummary: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Scan', ScanSchema);
