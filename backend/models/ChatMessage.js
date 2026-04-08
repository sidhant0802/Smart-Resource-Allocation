const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema(
  {
    reportId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Report',
      required: true,
      index:    true,
    },
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type:     String,
      required: true,
    },
    recommendation: {
      type: String,
      enum: ['send', 'draft', 'neutral', null],
      default: null,
    },
    confidence: {
      type:    Number,
      min:     0,
      max:     1,
      default: null,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatMessage', chatMessageSchema)