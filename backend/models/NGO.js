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
      default: '',
    },
    website: {
      type: String,
      default: '',
    },
    contactEmail: {
      type:      String,
      lowercase: true,
      trim:      true,
    },

    // Who manages this NGO
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    // Approval status
    status: {
      type:    String,
      enum:    ['pending', 'approved', 'declined', 'suspended'],
      default: 'pending',
    },

    // Decline / Suspend reason
    declineReason: String,

    // Location
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

    // Metadata
    approvedAt:  Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  {
    timestamps: true,
  }
)

// Geospatial index
ngoSchema.index({ location: '2dsphere' })
ngoSchema.index({ status: 1 })

module.exports = mongoose.model('NGO', ngoSchema)