const mongoose = require('mongoose')

const staffApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ngoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NGO',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    message: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNote: String,
  },
  { timestamps: true }
)

staffApplicationSchema.index({ userId: 1, ngoId: 1 }, { unique: true })
staffApplicationSchema.index({ ngoId: 1, status: 1 })

module.exports = mongoose.model('StaffApplication', staffApplicationSchema)