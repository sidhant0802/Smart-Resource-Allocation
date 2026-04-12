require('dotenv').config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')

const User = require('../models/User')
const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const Task = require('../models/Task')
const Report = require('../models/Report')
const NGO = require('../models/NGO')
const Zone = require('../models/Zone')
const Role = require('../models/Role')
const ChatMessage = require('../models/ChatMessage')
const StaffApplication = require('../models/StaffApplication')

const cleanDatabase = async () => {
  try {
    await connectDB()
    console.log('🔗 Connected to MongoDB')

    console.log('🗑️  Cleaning database...\n')

    const results = await Promise.all([
      VolunteerProfile.deleteMany({}),
      VolunteerApplication.deleteMany({}),
      Task.deleteMany({}),
      Report.deleteMany({}),
      ChatMessage.deleteMany({}),
      StaffApplication.deleteMany({}),
      User.deleteMany({}),
      NGO.deleteMany({}),
      Zone.deleteMany({})
    ])

    console.log('✅ Database cleaned successfully!\n')
    console.log('📊 Deleted:')
    console.log('   - Volunteer Profiles:', results[0].deletedCount)
    console.log('   - Volunteer Applications:', results[1].deletedCount)
    console.log('   - Tasks:', results[2].deletedCount)
    console.log('   - Reports:', results[3].deletedCount)
    console.log('   - Chat Messages:', results[4].deletedCount)
    console.log('   - Staff Applications:', results[5].deletedCount)
    console.log('   - Users:', results[6].deletedCount)
    console.log('   - NGOs:', results[7].deletedCount)
    console.log('   - Zones:', results[8].deletedCount)
    console.log('\n💡 Tip: Run "npm run seed:all" to populate fresh data')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error cleaning database:', error)
    process.exit(1)
  }
}

cleanDatabase()