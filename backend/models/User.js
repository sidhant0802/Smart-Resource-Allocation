const mongoose  = require('mongoose')
const bcrypt    = require('bcryptjs')
const validator = require('validator')

const userSchema = new mongoose.Schema(
  {
    // ── BASIC AUTH ──────────────────────────────
    email: {
      type:     String,
      required: [true, 'Email is required'],
      unique:   true,
      lowercase: true,
      trim:     true,
      validate: {
        validator: validator.isEmail,
        message:   'Please provide a valid email',
      },
    },
    password: {
      type:     String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:   false,
    },

    // ── ROLE ────────────────────────────────────
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Role',
      required: true,
    },
    roleName: {
      type: String,
      enum: [
        'super_admin',
        'ngo_manager',
        'committee_member',
        'ngo_staff',
        'volunteer',
      ],
      required: true,
    },

    // ── PROFILE ─────────────────────────────────
    fullName: {
      type:     String,
      required: [true, 'Full name is required'],
      trim:     true,
    },
    phone: {
      type:  String,
      trim:  true,
    },
    profileImage: String,

    // ── ORGANIZATION LINKS ───────────────────────
    // Primary NGO (the one staff signed up with)
    ngo: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'NGO',
    },

    // ✅ NEW: All NGOs this user can submit reports to
    approvedNgos: [
      {
        ngoId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'NGO',
        },
        approvedAt: {
          type: Date,
          default: Date.now,
        },
        approvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        }
      }
    ],

    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Zone',
    },

    // ── LOCATION (MAPBOX) ────────────────────────
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
    locationName:    String,
    operatingRadius: {
      type:    Number,
      default: 10,
    },

    // ── ACCOUNT STATUS ───────────────────────────
    status: {
      type:    String,
      enum:    ['pending', 'active', 'inactive', 'suspended'],
      default: 'pending',
    },

    // ── VOLUNTEER EXTRA INFO ─────────────────────
    volunteerProfile: {
      skills:          [String],
      taskPreferences: [String],
      availableDays:   [String],
      availableTime:   String,
      tasksCompleted:  { type: Number, default: 0 },
      hoursVolunteered:{ type: Number, default: 0 },
      peopleHelped:    { type: Number, default: 0 },
      rating:          { type: Number, default: 0 },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
      approvedAt:    Date,
      declineReason: String,
    },

    // ── NGO STAFF EXTRA INFO ─────────────────────
    staffProfile: {
      designation: String,
      appointedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
      appointedAt: Date,
    },

    // ── COMMITTEE MEMBER EXTRA INFO ──────────────
    committeeProfile: {
      appointedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'User',
      },
      appointedAt: Date,
    },

    // ── NGO MANAGER EXTRA INFO ───────────────────
    ngoManagerProfile: {
      ngoName:        String,
      ngoDescription: String,
      ngoWebsite:     String,
    },

    // ── TOKENS ──────────────────────────────────
    emailVerified:      { type: Boolean, default: false },
    emailVerifyToken:   String,
    resetToken:         String,
    resetTokenExpiry:   Date,
    lastLogin:          Date,

    // ── AUDIT ────────────────────────────────────
    appointedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
    appointedAt: Date,
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── INDEXES ─────────────────────────────────────────────────
userSchema.index({ location: '2dsphere' })
userSchema.index({ email: 1 })
userSchema.index({ roleName: 1 })
userSchema.index({ ngo: 1 })
userSchema.index({ zone: 1 })
userSchema.index({ status: 1 })

// ── HASH PASSWORD BEFORE SAVE ────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// ── COMPARE PASSWORD METHOD ──────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// ── Check if user can submit to a specific NGO ───────────────
userSchema.methods.canSubmitToNgo = function (ngoId) {
  const ngoIdStr = ngoId.toString()

  // Primary NGO always allowed
  if (this.ngo && this.ngo.toString() === ngoIdStr) return true

  // Check approved NGOs
  if (this.approvedNgos && this.approvedNgos.length > 0) {
    return this.approvedNgos.some(a => a.ngoId.toString() === ngoIdStr)
  }

  return false
}

// ── Get all NGO IDs user can submit to ───────────────────────
userSchema.methods.getAllowedNgoIds = function () {
  const ids = []
  if (this.ngo) ids.push(this.ngo.toString())
  if (this.approvedNgos) {
    this.approvedNgos.forEach(a => {
      const id = a.ngoId.toString()
      if (!ids.includes(id)) ids.push(id)
    })
  }
  return ids
}

// ── VIRTUAL: coordinates ────────────────────────────────────
userSchema.virtual('coordinates').get(function () {
  if (!this.location?.coordinates) return null
  return {
    lng: this.location.coordinates[0],
    lat: this.location.coordinates[1],
  }
})

module.exports = mongoose.model('User', userSchema)