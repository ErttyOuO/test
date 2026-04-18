import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Changed from ObjectId because frontend uses random local IDs like local-12345
  title: { type: String, required: true },
  date: { type: String },
  type: { type: String },
  color: { type: String },
  company: { type: String },
  policyNo: { type: String },
  fileData: { type: String }, // Base64 or URL
  fileType: { type: String },
  details: { type: Object }, // Storing nested coverage numbers
  isDRVerified: { type: Boolean, default: false },
  contentHash: { type: Number },
  extractedText: { type: String },
  aiReply: { type: String }, // Cached AI reply
  uploadDate: { type: Date, default: Date.now }
});

export default mongoose.model('Policy', policySchema);