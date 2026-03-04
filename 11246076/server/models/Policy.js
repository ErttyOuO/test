import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  insurer: { type: String },
  number: { type: String },
  date: { type: String },
  status: { type: String },
  groups: { type: Array }, // 儲存詳細保障內容
  term: { type: String },
  uploadDate: { type: Date, default: Date.now }
});

export default mongoose.model('Policy', policySchema);