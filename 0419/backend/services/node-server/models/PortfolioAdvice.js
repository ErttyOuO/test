import mongoose from 'mongoose';

const portfolioAdviceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true },
    advice: { type: String, required: true }
  },
  { timestamps: true }
);

// We only care about the latest advice per user
portfolioAdviceSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('PortfolioAdvice', portfolioAdviceSchema);
