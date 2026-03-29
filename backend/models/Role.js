const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      unique:   true,
      enum: [
        'super_admin',
        'ngo_manager',
        'committee_member',
        'ngo_staff',
        'volunteer',
      ],
    },
    displayName: {
      type:     String,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Role', roleSchema)