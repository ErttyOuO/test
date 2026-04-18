import mongoose from 'mongoose';

const chatGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    groupAvatar: { type: String, default: null },
    agentName: { type: String, required: true },
    agentAvatar: { type: String, default: null },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('ChatGroup', chatGroupSchema);
