const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema(
  {
    reportId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Report',
      required: true,
    },
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
    },
    content:        String,
    recommendation: String,
    confidence:     Number,
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatMessage', chatMessageSchema)