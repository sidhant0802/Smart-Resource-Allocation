require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Role = require('../models/Role')
const NGO = require('../models/NGO')
const Zone = require('../models/Zone')
const VolunteerProfile = require('../models/VolunteerProfile')
const VolunteerApplication = require('../models/VolunteerApplication')
const Task = require('../models/Task')
const Report = require('../models/Report')

const connectDB = require('../config/db')

const seedVolunteersAndTasks = async () => {
  try {
    await connectDB()
    console.log('✅ MongoDB Connected:', mongoose.connection.host)
    console.log('📦 Database:', mongoose.connection.name)

    // Clear existing data
    console.log('\n🗑️  Clearing existing volunteers, tasks, and applications...')
    await VolunteerProfile.deleteMany({})
    await VolunteerApplication.deleteMany({})
    await Task.deleteMany({})
    console.log('✅ Cleared old data\n')

    // ═══════════════════════════════════════════════════════════
    // GET EXISTING DATA
    // ═══════════════════════════════════════════════════════════

    const volunteerRole = await Role.findOne({ name: 'volunteer' })
    if (!volunteerRole) {
      throw new Error('Volunteer role not found. Run seedRoles.js first')
    }

    const ngos = await NGO.find().limit(3)
    const zones = await Zone.find().limit(5)

    console.log('📊 Found NGOs:', ngos.length)
    console.log('📊 Found Zones:', zones.length)

    if (ngos.length === 0) {
      throw new Error('No NGOs found. Run seedDummyData.js first')
    }

    if (zones.length === 0) {
      console.warn('⚠️  No zones found, proceeding without zone assignment')
    }

    // ═══════════════════════════════════════════════════════════
    // CREATE VOLUNTEER USERS
    // ═══════════════════════════════════════════════════════════

    console.log('\n👥 Creating volunteer users...')
    const volunteerUsers = [
      {
        fullName: 'Rahul Kumar',
        email: 'rahul.volunteer@gmail.com',
        password: 'password123',
        phone: '+91 9876543210',
        role: volunteerRole._id,
        roleName: 'volunteer',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139]
        },
        locationName: 'Connaught Place, New Delhi',
        zone: zones[0]?._id,
        status: 'active',
        skills: ['Communication', 'Physical Work', 'First Aid'],
        interests: ['Food Security', 'Healthcare']
      },
      {
        fullName: 'Priya Sharma',
        email: 'priya.volunteer@gmail.com',
        password: 'password123',
        phone: '+91 9876543211',
        role: volunteerRole._id,
        roleName: 'volunteer',
        location: {
          type: 'Point',
          coordinates: [77.2295, 28.6358]
        },
        locationName: 'Karol Bagh, New Delhi',
        zone: zones[0]?._id,
        status: 'active',
        skills: ['Teaching', 'Communication', 'Organization'],
        interests: ['Education', 'Community Development']
      },
      {
        fullName: 'Amit Patel',
        email: 'amit.volunteer@gmail.com',
        password: 'password123',
        phone: '+91 9876543212',
        role: volunteerRole._id,
        roleName: 'volunteer',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041]
        },
        locationName: 'Rohini, New Delhi',
        zone: zones[1]?._id,
        status: 'active',
        skills: ['First Aid', 'Physical Work', 'Driving'],
        interests: ['Healthcare', 'Disaster Relief']
      },
      {
        fullName: 'Sneha Reddy',
        email: 'sneha.volunteer@gmail.com',
        password: 'password123',
        phone: '+91 9876543213',
        role: volunteerRole._id,
        roleName: 'volunteer',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.6448]
        },
        locationName: 'Rajendra Place, New Delhi',
        zone: zones[1]?._id,
        status: 'active',
        skills: ['Communication', 'Teaching', 'Event Management'],
        interests: ['Education', 'Environment']
      },
      {
        fullName: 'Vikram Singh',
        email: 'vikram.volunteer@gmail.com',
        password: 'password123',
        phone: '+91 9876543214',
        role: volunteerRole._id,
        roleName: 'volunteer',
        location: {
          type: 'Point',
          coordinates: [77.3910, 28.5355]
        },
        locationName: 'Noida, Uttar Pradesh',
        zone: zones[2]?._id,
        status: 'active',
        skills: ['Physical Work', 'Gardening', 'Community Outreach'],
        interests: ['Environment', 'Community Development']
      }
    ]

    const createdVolunteers = await User.insertMany(volunteerUsers)
    console.log(`✅ Created ${createdVolunteers.length} volunteer users`)

    // ═══════════════════════════════════════════════════════════
    // CREATE VOLUNTEER PROFILES
    // ═══════════════════════════════════════════════════════════

    console.log('\n📝 Creating volunteer profiles...')
    const volunteerProfiles = createdVolunteers.map((volunteer, index) => ({
      userId: volunteer._id,
      location: volunteer.location,
      locationName: volunteer.locationName,
      availabilityStatus: index < 3 ? 'FREE' : index === 3 ? 'BUSY' : 'PENDING',
      currentTaskId: null,
      busyUntil: null,
      skills: volunteer.skills || [],
      interests: volunteer.interests || [],
      bio: `Passionate volunteer dedicated to ${volunteer.interests?.[0] || 'community service'}. Ready to make a difference!`,
      phoneNumber: volunteer.phone,
      tasksCompleted: Math.floor(Math.random() * 10) + 1,
      peopleHelped: Math.floor(Math.random() * 100) + 20,
      rating: 4 + Math.random(),
      totalReviews: Math.floor(Math.random() * 20) + 5,
      maxDistance: 50,
      maxTasksPerMonth: 5,
      preferredCategories: volunteer.interests || []
    }))

    const createdProfiles = await VolunteerProfile.insertMany(volunteerProfiles)
    console.log(`✅ Created ${createdProfiles.length} volunteer profiles`)

    // ═══════════════════════════════════════════════════════════
    // CREATE VOLUNTEER APPLICATIONS TO NGOs
    // ═══════════════════════════════════════════════════════════

    console.log('\n📋 Creating volunteer applications...')
    const applications = []
    createdVolunteers.forEach((volunteer, vIndex) => {
      // Each volunteer applies to 2-3 NGOs
      const ngoCount = Math.floor(Math.random() * 2) + 2
      for (let i = 0; i < ngoCount && i < ngos.length; i++) {
        applications.push({
          volunteerId: volunteer._id,
          ngoId: ngos[i]._id,
          status: vIndex % 3 === 0 ? 'approved' : vIndex % 3 === 1 ? 'pending' : 'approved',
          appliedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          approvedAt: vIndex % 3 !== 1 ? new Date() : null
        })
      }
    })

    const createdApplications = await VolunteerApplication.insertMany(applications)
    console.log(`✅ Created ${createdApplications.length} volunteer applications`)

    // ═══════════════════════════════════════════════════════════
    // CREATE SAMPLE REPORTS
    // ═══════════════════════════════════════════════════════════

    console.log('\n📄 Creating sample reports...')
    const sampleReports = [
  {
    title: 'Food shortage in slum area',
    submittedBy: createdVolunteers[0]._id,
    ngo: ngos[0]._id,
    zone: zones[0]?._id,
    locationName: 'Connaught Place, New Delhi',
    status: 'reviewed',
    visibility: 'sent',
    analysis: {
      category: 'Food',              // ✅ was 'Food Security'
      severityLevel: 'critical',
      urgencyScore: 85,
      keywords: ['food', 'hunger', 'families', 'urgent'],
      affectedPeople: 50,
      summary: 'Critical food shortage affecting 50 families. Immediate intervention required.',
      immediateRisk: true
    }
  },
  {
    title: 'Medical camp needed for elderly',
    submittedBy: createdVolunteers[1]._id,
    ngo: ngos[1]._id,
    zone: zones[0]?._id,
    locationName: 'Karol Bagh, New Delhi',
    status: 'reviewed',
    visibility: 'sent',
    analysis: {
      category: 'Health',            // ✅ was 'Healthcare'
      severityLevel: 'high',
      urgencyScore: 72,
      keywords: ['medical', 'elderly', 'health', 'checkup'],
      affectedPeople: 30,
      summary: 'Health checkup camp needed for 30+ senior citizens.',
      immediateRisk: false
    }
  },
  {
    title: 'Education materials needed',
    submittedBy: createdVolunteers[2]._id,
    ngo: ngos[2]._id,
    zone: zones[1]?._id,
    locationName: 'Rohini, New Delhi',
    status: 'reviewed',
    visibility: 'sent',
    analysis: {
      category: 'Education',         // ✅ this one was already correct
      severityLevel: 'medium',
      urgencyScore: 60,
      keywords: ['education', 'books', 'students', 'exams'],
      affectedPeople: 40,
      summary: '40 students need educational materials for exams.',
      immediateRisk: false
    }
  }
]

    const createdReports = await Report.insertMany(sampleReports)
    console.log(`✅ Created ${createdReports.length} reports`)

    // ═══════════════════════════════════════════════════════════
    // CREATE TASKS
    // ═══════════════════════════════════════════════════════════

    console.log('\n📋 Creating tasks...')
    const tasks = [
      // Task 1: Food Distribution (Open - needs volunteers)
      {
        reportId: createdReports[0]._id,
        ngoId: ngos[0]._id,
        title: 'Food Distribution Drive',
        description: 'Help distribute meals to 50 families in the slum area. We need volunteers to help pack and distribute food packets.',
        category: 'Food Security',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139]
        },
        locationName: 'Connaught Place, New Delhi',
        volunteersNeeded: 5,
        assignedVolunteers: [
          {
            volunteerId: createdVolunteers[0]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            volunteerId: createdVolunteers[1]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ],
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        duration: 3,
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'open',
        urgencyScore: 85,
        skillsRequired: ['Communication', 'Physical Work'],
        affectedPeople: 50
      },

      // Task 2: Medical Camp Setup (Open)
      {
        reportId: createdReports[1]._id,
        ngoId: ngos[1]._id,
        title: 'Medical Camp Setup',
        description: 'Assist in setting up a health checkup camp for senior citizens. Need volunteers with basic first aid knowledge.',
        category: 'Healthcare',
        location: {
          type: 'Point',
          coordinates: [77.2295, 28.6358]
        },
        locationName: 'Karol Bagh, New Delhi',
        volunteersNeeded: 3,
        assignedVolunteers: [
          {
            volunteerId: createdVolunteers[2]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ],
        startDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        duration: 2,
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        status: 'open',
        urgencyScore: 72,
        skillsRequired: ['First Aid', 'Organization'],
        affectedPeople: 30
      },

      // Task 3: Education Material Distribution (In Progress)
      {
        reportId: createdReports[2]._id,
        ngoId: ngos[2]._id,
        title: 'Education Material Distribution',
        description: 'Distribute books and stationery to underprivileged students preparing for exams.',
        category: 'Education',
        location: {
          type: 'Point',
          coordinates: [77.1025, 28.7041]
        },
        locationName: 'Rohini, New Delhi',
        volunteersNeeded: 4,
        assignedVolunteers: [
          {
            volunteerId: createdVolunteers[1]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            volunteerId: createdVolunteers[3]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            volunteerId: createdVolunteers[4]._id,
            status: 'accepted',
            respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
          }
        ],
        startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        duration: 5,
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        status: 'in-progress',
        urgencyScore: 60,
        skillsRequired: ['Communication', 'Teaching'],
        affectedPeople: 40
      },

      // Task 4: Completed Task (for history)
      {
        reportId: createdReports[0]._id,
        ngoId: ngos[0]._id,
        title: 'Elderly Care Visit',
        description: 'Visit and assist elderly residents with daily activities and companionship.',
        category: 'Healthcare',
        location: {
          type: 'Point',
          coordinates: [77.2167, 28.6448]
        },
        locationName: 'Rajendra Place, New Delhi',
        volunteersNeeded: 2,
        assignedVolunteers: [
          {
            volunteerId: createdVolunteers[0]._id,
            status: 'completed',
            respondedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            rating: 4.5,
            feedback: 'Great work! Very helpful and caring with the elderly residents.'
          },
          {
            volunteerId: createdVolunteers[2]._id,
            status: 'completed',
            respondedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            rating: 4.0,
            feedback: 'Good participation and dedication.'
          }
        ],
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        duration: 3,
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: 'completed',
        urgencyScore: 55,
        skillsRequired: ['Communication', 'First Aid'],
        affectedPeople: 15
      },

      // Task 5: Park Cleaning (Completed)
      {
        reportId: createdReports[0]._id,
        ngoId: ngos[0]._id,
        title: 'Park Cleaning Drive',
        description: 'Help clean and maintain local park area.',
        category: 'Environment',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139]
        },
        locationName: 'India Gate, New Delhi',
        volunteersNeeded: 3,
        assignedVolunteers: [
          {
            volunteerId: createdVolunteers[1]._id,
            status: 'completed',
            respondedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
            rating: 4.0,
            feedback: 'Good teamwork and effort!'
          }
        ],
        startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        duration: 2,
        endDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        status: 'completed',
        urgencyScore: 45,
        skillsRequired: ['Physical Work'],
        affectedPeople: 100
      }
    ]

    const createdTasks = await Task.insertMany(tasks)
    console.log(`✅ Created ${createdTasks.length} tasks`)

    // Update volunteer profiles for assigned tasks
    await VolunteerProfile.findOneAndUpdate(
      { userId: createdVolunteers[3]._id },
      {
        availabilityStatus: 'BUSY',
        currentTaskId: createdTasks[2]._id,
        busyUntil: createdTasks[2].endDate
      }
    )

    console.log('✅ Updated volunteer availability status\n')

    // ═══════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════

    console.log('='.repeat(60))
    console.log('✅ SEED DATA CREATED SUCCESSFULLY!')
    console.log('='.repeat(60))
    console.log(`👥 Volunteers Created: ${createdVolunteers.length}`)
    console.log(`📝 Volunteer Profiles: ${createdProfiles.length}`)
    console.log(`📋 Applications: ${createdApplications.length}`)
    console.log(`📄 Reports: ${createdReports.length}`)
    console.log(`🎯 Tasks Created: ${createdTasks.length}`)
    console.log('='.repeat(60))
    console.log('\n📧 Test Volunteer Accounts:\n')
    createdVolunteers.forEach((vol, idx) => {
      console.log(`   Email: ${vol.email} | Password: password123`)
    })
    console.log('='.repeat(60) + '\n')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

seedVolunteersAndTasks()