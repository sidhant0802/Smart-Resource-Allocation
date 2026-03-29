require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })

const mongoose  = require('mongoose')
const connectDB = require('../config/db')
const Role      = require('../models/Role')

const roles = [
  {
    name:        'super_admin',
    displayName: 'Super Admin',
    description: 'Platform owner. Manages all NGOs.',
  },
  {
    name:        'ngo_manager',
    displayName: 'NGO Manager',
    description: 'Manages an NGO. Appoints committee members.',
  },
  {
    name:        'committee_member',
    displayName: 'Committee Member',
    description: 'Manages a zone. Appoints staff, approves volunteers.',
  },
  {
    name:        'ngo_staff',
    displayName: 'NGO Staff',
    description: 'Publishes community data in any format.',
  },
  {
    name:        'volunteer',
    displayName: 'Volunteer',
    description: 'Performs tasks near their location.',
  },
]

const seedRoles = async () => {
  await connectDB()

  try {
    // Clear existing roles
    await Role.deleteMany({})
    console.log('🗑️  Cleared existing roles')

    // Insert roles
    const inserted = await Role.insertMany(roles)
    console.log('✅ Roles seeded successfully:')
    inserted.forEach(r => console.log(`   → ${r.name} (${r._id})`))

    // Also create Super Admin user
    const User = require('../models/User')
    const bcrypt = require('bcryptjs')

    const superAdminRole = inserted.find(
      r => r.name === 'super_admin'
    )

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ 
      roleName: 'super_admin' 
    })

    if (!existingAdmin) {
      await User.create({
        email:       'superadmin@platform.com',
        password:    'Admin@123456',
        fullName:    'Super Admin',
        phone:       '+91-0000000000',
        role:        superAdminRole._id,
        roleName:    'super_admin',
        status:      'active',
        location: {
          type:        'Point',
          coordinates: [77.2090, 28.6139], // Delhi
        },
        locationName: 'New Delhi, India',
      })
      console.log('\n👑 Super Admin created:')
      console.log('   Email:    superadmin@platform.com')
      console.log('   Password: Admin@123456')
    } else {
      console.log('\n👑 Super Admin already exists')
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    process.exit(1)
  }
}

seedRoles()