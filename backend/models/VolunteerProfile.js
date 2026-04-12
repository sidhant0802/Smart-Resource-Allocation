const mongoose = require('mongoose')

const volunteerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Personal Info
  bio: String,
  phoneNumber: String,
  profileImage: String,
  
  // Location & Availability
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  locationName: String,
  
  // Availability Status
  availabilityStatus: {
    type: String,
    enum: ['FREE', 'BUSY', 'PENDING'],
    default: 'FREE'
  },
  currentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  busyUntil: {
    type: Date,
    default: null
  },
  
  // Skills & Interests
  skills: [String],
  interests: [String],
  
  // Statistics
  tasksCompleted: {
    type: Number,
    default: 0
  },
  peopleHelped: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  
  // Preferences
  maxTasksPerMonth: {
    type: Number,
    default: 5
  },
  preferredCategories: [String],
  maxDistance: {
    type: Number,
    default: 50 // km
  },
  
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
  collection: 'volunteerprofiles',
  timestamps: true 
})

// Geospatial index for location-based queries
volunteerProfileSchema.index({ location: '2dsphere' })

module.exports = mongoose.model('VolunteerProfile', volunteerProfileSchema)