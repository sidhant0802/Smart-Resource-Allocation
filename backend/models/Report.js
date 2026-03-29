const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    // Who submitted
    submittedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    ngo: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'NGO',
      required: true,
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Zone',
    },

    // Report details
    title: {
      type:    String,
      default: 'Untitled Report',
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image', 'voice', 'text'],
    },
    fileUrl:      String,
    fileName:     String,
    fileSize:     Number,
    originalText: String,

    // ── KEY FIELD: Staff decides where report goes ──
    visibility: {
      type:    String,
      enum:    ['draft', 'sent'],
      default: 'draft',
      // draft = only staff sees it
      // sent  = committee can see it
    },

    // Gemini AI Analysis
    analysis: {
      // Core scores
      urgencyScore: {
        type:    Number,
        min:     0,
        max:     100,
        default: 0,
      },
      severityLevel: {
        type:    String,
        enum:    ['critical', 'high', 'medium', 'low', 'info'],
        default: 'info',
      },

      // Gemini outputs
      summary:          String,
      // 2-3 line AI summary
      detailedAnalysis: String,
      // Full Gemini analysis paragraph
      keyProblems:      [String],
      // List of main problems found
      suggestedActions: [String],
      // AI recommended actions
      keywords:         [String],
      // Important keywords
      category: {
        type: String,
        enum: [
          'Health', 'Food', 'Water', 'Education',
          'Shelter', 'Sanitation', 'Disaster',
          'Violence', 'Infrastructure', 'Other',
        ],
        default: 'Other',
      },
      sentiment: {
        type: String,
        enum: ['very_negative', 'negative', 'neutral', 'positive'],
        default: 'neutral',
      },
      affectedPeople:    Number,
      affectedArea:      String,
      immediateRisk:     Boolean,
      processingTime:    Number,

      // Gemini model used
      model: String,
    },

    // Processing status
    status: {
      type:    String,
      enum:    ['processing', 'analyzed', 'reviewed', 'resolved', 'rejected'],
      default: 'processing',
    },

    // Committee review
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:   Date,
    reviewNotes:  String,

    // Location
    manualDescription: String,
    locationName:      String,
    latitude:          Number,
    longitude:         Number,
  },
  { timestamps: true }
)

reportSchema.index({ ngo:    1 })
reportSchema.index({ zone:   1 })
reportSchema.index({ status: 1 })
reportSchema.index({ visibility: 1 })
reportSchema.index({ 'analysis.urgencyScore': -1 })

module.exports = mongoose.model('Report', reportSchema)