const mongoose = require('mongoose')

const workerAssignmentSchema = new mongoose.Schema({
  // ── ASSIGNMENT BASICS ────────────────────────────────────
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  ngoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO',
    required: true
  },

  // ── WHO CREATED THIS ASSIGNMENT ──────────────────────────
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // committee_member
    required: true
  },

  // ── SLOT TRACKING ────────────────────────────────────────
  totalSlotsNeeded: {
    type: Number,
    required: true,
    min: 1
  },
  filledSlots: {
    type: Number,
    default: 0
  },

  // ── DURATION ─────────────────────────────────────────────
  durationDays: {
    type: Number,
    required: true,
    min: 1
  },
  startDate: Date,
  endDate: Date,

  // ── SLOT ASSIGNMENTS WITH INDIVIDUAL TRACKING ────────────
  slots: [
    {
      slotNumber: Number,
      volunteerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      email: String,
      phone: String,
      fullName: String,

      // ── APPROVAL STATUS ──────────────────────────────────
      status: {
        type: String,
        enum: [
          'pending_assignment',
          'assignment_sent',
          'pending_approval',
          'approved',
          'rejected',
          'completed'
        ],
        default: 'pending_assignment'
      },

      // ── EMAIL TRACKING ───────────────────────────────────
      assignmentEmailSentAt: Date,
      assignmentEmailToken: String,
      assignmentEmailTokenExpiry: Date,

      // ── APPROVAL TRACKING ────────────────────────────────
      approvalResponseAt: Date,
      approvalNotes: String,

      // ── WORK TRACKING ────────────────────────────────────
      startedAt: Date,
      completedAt: Date,
      feedback: String,
      rating: Number,

      // ── METADATA ─────────────────────────────────────────
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],

  // ── OVERALL STATUS ───────────────────────────────────────
  assignmentStatus: {
    type: String,
    enum: ['draft', 'pending', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },

  // ── NOTES ────────────────────────────────────────────────
  notes: String,

  // ── METADATA ─────────────────────────────────────────────
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true })

// ── INDEXES ──────────────────────────────────────────────────
workerAssignmentSchema.index({ reportId: 1 })
workerAssignmentSchema.index({ taskId: 1 })
workerAssignmentSchema.index({ ngoId: 1 })
workerAssignmentSchema.index({ createdBy: 1 })
workerAssignmentSchema.index({ assignmentStatus: 1 })
workerAssignmentSchema.index({ 'slots.volunteerId': 1 })

// ── METHODS ──────────────────────────────────────────────────

// Get progress string like "2/3"
workerAssignmentSchema.methods.getProgress = function () {
  const approved = this.slots.filter(s => s.status === 'approved').length
  return `${approved}/${this.totalSlotsNeeded}`
}

// Check if all slots are filled
workerAssignmentSchema.methods.isFullyAssigned = function () {
  const approved = this.slots.filter(s => s.status === 'approved').length
  return approved === this.totalSlotsNeeded
}

// Get next available slot
workerAssignmentSchema.methods.getNextAvailableSlot = function () {
  return this.slots.find(s => s.status === 'pending_assignment')
}

// Get pending approval slots
workerAssignmentSchema.methods.getPendingApprovalSlots = function () {
  return this.slots.filter(s => s.status === 'pending_approval')
}

module.exports = mongoose.model('WorkerAssignment', workerAssignmentSchema)