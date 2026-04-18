import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    groupId: { type: String, default: null },
    userId: { type: String, default: null },
    role: { type: String, required: true },
    text: { type: String, default: '' },
    timestamp: { type: String, required: true },
    file: { type: Object, default: null },
    senderName: { type: String, default: null },
    senderAvatar: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    clientId: { type: String, default: null },
    senderId: { type: String, default: null }
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
