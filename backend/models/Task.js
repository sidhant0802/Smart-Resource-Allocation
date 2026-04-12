const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['Food Security', 'Healthcare', 'Education', 'Environment', 'Disaster Relief', 'Community Development'],
    required: true
  },
  
  // Report Association
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  
  // NGO Association
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: true
  },
  
  // Location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  locationName: String,
  
  // Volunteers
  volunteersNeeded: {
    type: Number,
    required: true
  },
  assignedVolunteers: [
    {
      volunteerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        // ✅ Added 'pending_approval' for committee approval workflow
        enum: ['invited', 'pending_approval', 'accepted', 'rejected', 'completed'],
        default: 'invited'
      },
      respondedAt: Date,
      completedAt: Date,
      rating: Number,
      feedback: String
    }
  ],
  
  // Duration & Schedule
  startDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in days
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'cancelled'],
    default: 'open'
  },
  
  // Priority
  urgencyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  
  // Requirements
  skillsRequired: [String],
  affectedPeople: Number,
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  collection: 'tasks',
  timestamps: true 
})

// Geospatial index
taskSchema.index({ location: '2dsphere' })
// Compound indexes
taskSchema.index({ ngoId: 1, status: 1 })
taskSchema.index({ status: 1, startDate: 1 })

module.exports = mongoose.model('Task', taskSchema)