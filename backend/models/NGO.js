const mongoose = require('mongoose')

const ngoSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'NGO name is required'],
      trim:     true,
    },
    description: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },

    status: {
      type:    String,
      enum:    ['pending', 'approved', 'declined', 'suspended'],
      default: 'pending',
    },

    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:    Date,
    declineReason: String,

    managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Fixed location field ──
    location: {
      type: {
        type:    String,
        enum:    ['Point'],
        default: 'Point',
      },
      coordinates: {
        type:    [Number],
        default: [0, 0],
      },
    },
    locationName: String,

    totalZones:      { type: Number, default: 0 },
    totalVolunteers: { type: Number, default: 0 },
    totalTasksDone:  { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Geospatial index
ngoSchema.index({ location: '2dsphere' })

module.exports = mongoose.model('NGO', ngoSchema)