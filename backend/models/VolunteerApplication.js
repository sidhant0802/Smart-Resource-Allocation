const mongoose = require('mongoose')

const volunteerApplicationSchema = new mongoose.Schema({
  volunteerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Application Details
  appliedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  rejectedAt: Date,
  
  rejectionReason: String,
  
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
  collection: 'volunteerapplications',
  timestamps: true 
})

// Compound unique index - prevent duplicate applications
volunteerApplicationSchema.index({ volunteerId: 1, ngoId: 1 }, { unique: true })

module.exports = mongoose.model('VolunteerApplication', volunteerApplicationSchema)