import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // 關聯到使用者
  authorName: { type: String }, // 冗餘儲存顯示名稱，方便查詢
  createdAt: { type: Date, default: Date.now },
  tags: [String],
  likes: { type: Number, default: 0 }
});

export default mongoose.model('Post', postSchema);