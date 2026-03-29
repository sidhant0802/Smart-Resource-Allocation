const mongoose = require('mongoose')

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Zone name is required'],
      trim:     true,
    },
    description: String,

    // Which NGO this zone belongs to
    ngo: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'NGO',
      required: true,
    },

    // Committee member appointed for this zone
    committeeMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
    ],

    // Location data (Mapbox)
    latitude:    Number,
    longitude:   Number,
    locationName: String,

    // GeoJSON boundary (optional)
    boundary: {
      type:        { type: String, enum: ['Polygon'] },
      coordinates: [[[Number]]],
    },

    city:    String,
    state:   String,
    country: String,
    pincode: String,

    // Who created this zone
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },

    status: {
      type:    String,
      enum:    ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Zone', zoneSchema)