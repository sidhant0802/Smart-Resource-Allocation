require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env')
})

const mongoose  = require('mongoose')
const bcrypt    = require('bcryptjs')
const connectDB = require('../config/db')

const User = require('../models/User')
const NGO  = require('../models/NGO')
const Zone = require('../models/Zone')
const Role = require('../models/Role')
const StaffApplication = require('../models/StaffApplication')

const seedDummyData = async () => {
  await connectDB()

  try {
    console.log('🗑️  Clearing old dummy data...')

    await Zone.deleteMany({})
    await NGO.deleteMany({})
    await StaffApplication.deleteMany({})
    await User.deleteMany({ roleName: { $ne: 'super_admin' } })

    console.log('✅ Cleared old data')

    const roles = await Role.find()
    const getRole = (name) => roles.find(r => r.name === name)

    // ════════════════════════════════════════
    // NGOs
    // ════════════════════════════════════════
    console.log('\n🏢 Creating NGOs...')

    const ngo1 = await NGO.create({
      name: 'Hope Foundation India',
      description: 'Working towards healthcare and education for underprivileged communities across North India',
      website: 'https://hopefoundation.in',
      contactEmail: 'contact@hopefoundation.in',
      status: 'approved',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      locationName: 'New Delhi, India',
    })

    const ngo2 = await NGO.create({
      name: 'Green Earth NGO',
      description: 'Environmental conservation and sustainable development in rural Maharashtra',
      website: 'https://greenearth.org.in',
      contactEmail: 'info@greenearth.org.in',
      status: 'approved',
      location: { type: 'Point', coordinates: [72.8777, 19.0760] },
      locationName: 'Mumbai, Maharashtra',
    })

    const ngo3 = await NGO.create({
      name: 'Seva Karnataka Trust',
      description: 'Rural development and women empowerment in Karnataka',
      website: 'https://sevakarnataka.org',
      contactEmail: 'hello@sevakarnataka.org',
      status: 'pending',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      locationName: 'Bengaluru, Karnataka',
    })

    console.log('  ✅ NGO 1: Hope Foundation India (approved)')
    console.log('  ✅ NGO 2: Green Earth NGO (approved)')
    console.log('  ✅ NGO 3: Seva Karnataka Trust (pending)')

    // ════════════════════════════════════════
    // NGO MANAGERS
    // ════════════════════════════════════════
    console.log('\n👔 Creating NGO Managers...')

    const manager1 = await User.create({
      email: 'manager1@hopefoundation.in', password: 'Manager@123',
      fullName: 'Rajesh Kumar Sharma', phone: '+91-9876543010',
      role: getRole('ngo_manager')._id, roleName: 'ngo_manager',
      ngo: ngo1._id, status: 'active',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      locationName: 'New Delhi, India', operatingRadius: 50,
      ngoManagerProfile: { ngoName: 'Hope Foundation India', ngoDescription: 'Healthcare and education', ngoWebsite: 'https://hopefoundation.in' },
    })

    const manager2 = await User.create({
      email: 'manager2@greenearth.in', password: 'Manager@123',
      fullName: 'Priya Mehta', phone: '+91-9876543011',
      role: getRole('ngo_manager')._id, roleName: 'ngo_manager',
      ngo: ngo2._id, status: 'active',
      location: { type: 'Point', coordinates: [72.8777, 19.0760] },
      locationName: 'Mumbai, Maharashtra', operatingRadius: 40,
      ngoManagerProfile: { ngoName: 'Green Earth NGO', ngoDescription: 'Environmental conservation', ngoWebsite: 'https://greenearth.org.in' },
    })

    const manager3 = await User.create({
      email: 'manager3@sevakarnataka.in', password: 'Manager@123',
      fullName: 'Suresh Gowda', phone: '+91-9876543012',
      role: getRole('ngo_manager')._id, roleName: 'ngo_manager',
      ngo: ngo3._id, status: 'pending',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      locationName: 'Bengaluru, Karnataka', operatingRadius: 30,
      ngoManagerProfile: { ngoName: 'Seva Karnataka Trust', ngoDescription: 'Rural development', ngoWebsite: 'https://sevakarnataka.org' },
    })

    await NGO.findByIdAndUpdate(ngo1._id, { managedBy: manager1._id })
    await NGO.findByIdAndUpdate(ngo2._id, { managedBy: manager2._id })
    await NGO.findByIdAndUpdate(ngo3._id, { managedBy: manager3._id })

    console.log('  ✅ Manager 1: Rajesh Kumar (Hope Foundation) - active')
    console.log('  ✅ Manager 2: Priya Mehta (Green Earth) - active')
    console.log('  ✅ Manager 3: Suresh Gowda (Seva Karnataka) - pending')

    // ════════════════════════════════════════
    // ZONES
    // ════════════════════════════════════════
    console.log('\n📍 Creating Zones...')

    const zone1 = await Zone.create({
      name: 'North Delhi Zone', description: 'Covers North Delhi districts',
      ngo: ngo1._id, latitude: 28.7041, longitude: 77.1025,
      locationName: 'North Delhi, Delhi', city: 'North Delhi', state: 'Delhi',
      country: 'India', pincode: '110009', createdBy: manager1._id, status: 'active',
    })

    const zone2 = await Zone.create({
      name: 'South Delhi Zone', description: 'Covers South Delhi areas',
      ngo: ngo1._id, latitude: 28.5245, longitude: 77.1855,
      locationName: 'South Delhi, Delhi', city: 'South Delhi', state: 'Delhi',
      country: 'India', pincode: '110017', createdBy: manager1._id, status: 'active',
    })

    const zone3 = await Zone.create({
      name: 'East Delhi Zone', description: 'Covers East Delhi',
      ngo: ngo1._id, latitude: 28.6275, longitude: 77.2937,
      locationName: 'East Delhi, Delhi', city: 'East Delhi', state: 'Delhi',
      country: 'India', pincode: '110092', createdBy: manager1._id, status: 'active',
    })

    const zone4 = await Zone.create({
      name: 'Mumbai Central Zone', description: 'Covers Mumbai Central',
      ngo: ngo2._id, latitude: 18.9690, longitude: 72.8205,
      locationName: 'Mumbai Central, Maharashtra', city: 'Mumbai', state: 'Maharashtra',
      country: 'India', pincode: '400008', createdBy: manager2._id, status: 'active',
    })

    const zone5 = await Zone.create({
      name: 'Thane Zone', description: 'Covers Thane district',
      ngo: ngo2._id, latitude: 19.2183, longitude: 72.9781,
      locationName: 'Thane, Maharashtra', city: 'Thane', state: 'Maharashtra',
      country: 'India', pincode: '400601', createdBy: manager2._id, status: 'active',
    })

    console.log('  ✅ Zone 1: North Delhi (Hope Foundation)')
    console.log('  ✅ Zone 2: South Delhi (Hope Foundation)')
    console.log('  ✅ Zone 3: East Delhi (Hope Foundation)')
    console.log('  ✅ Zone 4: Mumbai Central (Green Earth)')
    console.log('  ✅ Zone 5: Thane (Green Earth)')

    // ════════════════════════════════════════
    // COMMITTEE MEMBERS
    // ════════════════════════════════════════
    console.log('\n👥 Creating Committee Members...')

    const committee1 = await User.create({
      email: 'committee1@hopefoundation.in', password: 'Committee@123',
      fullName: 'Anita Singh', phone: '+91-9876543020',
      role: getRole('committee_member')._id, roleName: 'committee_member',
      ngo: ngo1._id, zone: zone1._id, status: 'active',
      location: { type: 'Point', coordinates: [77.1025, 28.7041] },
      locationName: 'North Delhi, Delhi', operatingRadius: 15,
      committeeProfile: { appointedBy: manager1._id, appointedAt: new Date() },
    })

    const committee2 = await User.create({
      email: 'committee2@hopefoundation.in', password: 'Committee@123',
      fullName: 'Vikram Patel', phone: '+91-9876543021',
      role: getRole('committee_member')._id, roleName: 'committee_member',
      ngo: ngo1._id, zone: zone2._id, status: 'active',
      location: { type: 'Point', coordinates: [77.1855, 28.5245] },
      locationName: 'South Delhi, Delhi', operatingRadius: 15,
      committeeProfile: { appointedBy: manager1._id, appointedAt: new Date() },
    })

    const committee3 = await User.create({
      email: 'committee3@hopefoundation.in', password: 'Committee@123',
      fullName: 'Meena Gupta', phone: '+91-9876543022',
      role: getRole('committee_member')._id, roleName: 'committee_member',
      ngo: ngo1._id, zone: zone3._id, status: 'active',
      location: { type: 'Point', coordinates: [77.2937, 28.6275] },
      locationName: 'East Delhi, Delhi', operatingRadius: 15,
      committeeProfile: { appointedBy: manager1._id, appointedAt: new Date() },
    })

    const committee4 = await User.create({
      email: 'committee4@greenearth.in', password: 'Committee@123',
      fullName: 'Rohan Desai', phone: '+91-9876543023',
      role: getRole('committee_member')._id, roleName: 'committee_member',
      ngo: ngo2._id, zone: zone4._id, status: 'active',
      location: { type: 'Point', coordinates: [72.8205, 18.9690] },
      locationName: 'Mumbai Central, Maharashtra', operatingRadius: 10,
      committeeProfile: { appointedBy: manager2._id, appointedAt: new Date() },
    })

    await User.create({
      email: 'committee5@hopefoundation.in', password: 'Committee@123',
      fullName: 'Deepak Verma', phone: '+91-9876543024',
      role: getRole('committee_member')._id, roleName: 'committee_member',
      ngo: ngo1._id, status: 'pending',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      locationName: 'New Delhi, Delhi', operatingRadius: 10,
    })

    await Zone.findByIdAndUpdate(zone1._id, { $push: { committeeMembers: committee1._id } })
    await Zone.findByIdAndUpdate(zone2._id, { $push: { committeeMembers: committee2._id } })
    await Zone.findByIdAndUpdate(zone3._id, { $push: { committeeMembers: committee3._id } })
    await Zone.findByIdAndUpdate(zone4._id, { $push: { committeeMembers: committee4._id } })

    console.log('  ✅ Committee 1: Anita Singh (North Delhi) - active')
    console.log('  ✅ Committee 2: Vikram Patel (South Delhi) - active')
    console.log('  ✅ Committee 3: Meena Gupta (East Delhi) - active')
    console.log('  ✅ Committee 4: Rohan Desai (Mumbai Central) - active')
    console.log('  ✅ Committee 5: Deepak Verma (pending)')

    // ════════════════════════════════════════
    // NGO STAFF (with multi-NGO support)
    // ════════════════════════════════════════
    console.log('\n📋 Creating NGO Staff...')

    const staff1 = await User.create({
      email: 'staff1@hopefoundation.in', password: 'Staff@123',
      fullName: 'Kavita Sharma', phone: '+91-9876543030',
      role: getRole('ngo_staff')._id, roleName: 'ngo_staff',
      ngo: ngo1._id, zone: zone1._id, status: 'active',
      location: { type: 'Point', coordinates: [77.1025, 28.7041] },
      locationName: 'North Delhi, Delhi', operatingRadius: 10,
      staffProfile: { designation: 'Field Data Collector', appointedBy: committee1._id, appointedAt: new Date() },
      // ✅ Staff1 also approved for Green Earth
      approvedNgos: [
        { ngoId: ngo2._id, approvedAt: new Date(), approvedBy: manager2._id }
      ]
    })

    const staff2 = await User.create({
      email: 'staff2@hopefoundation.in', password: 'Staff@123',
      fullName: 'Amit Yadav', phone: '+91-9876543031',
      role: getRole('ngo_staff')._id, roleName: 'ngo_staff',
      ngo: ngo1._id, zone: zone2._id, status: 'active',
      location: { type: 'Point', coordinates: [77.1855, 28.5245] },
      locationName: 'South Delhi, Delhi', operatingRadius: 10,
      staffProfile: { designation: 'Survey Coordinator', appointedBy: committee2._id, appointedAt: new Date() },
      approvedNgos: []
    })

    const staff3 = await User.create({
      email: 'staff3@greenearth.in', password: 'Staff@123',
      fullName: 'Sunita Patil', phone: '+91-9876543032',
      role: getRole('ngo_staff')._id, roleName: 'ngo_staff',
      ngo: ngo2._id, zone: zone4._id, status: 'active',
      location: { type: 'Point', coordinates: [72.8205, 18.9690] },
      locationName: 'Mumbai Central, Maharashtra', operatingRadius: 10,
      staffProfile: { designation: 'Field Officer', appointedBy: committee4._id, appointedAt: new Date() },
      // ✅ Staff3 also approved for Hope Foundation
      approvedNgos: [
        { ngoId: ngo1._id, approvedAt: new Date(), approvedBy: manager1._id }
      ]
    })

    await User.create({
      email: 'staff4@hopefoundation.in', password: 'Staff@123',
      fullName: 'Ravi Mishra', phone: '+91-9876543033',
      role: getRole('ngo_staff')._id, roleName: 'ngo_staff',
      ngo: ngo1._id, status: 'pending',
      location: { type: 'Point', coordinates: [77.2090, 28.6139] },
      locationName: 'New Delhi, Delhi', operatingRadius: 8,
      approvedNgos: []
    })

    console.log('  ✅ Staff 1: Kavita Sharma (Hope Foundation + Green Earth approved)')
    console.log('  ✅ Staff 2: Amit Yadav (Hope Foundation only)')
    console.log('  ✅ Staff 3: Sunita Patil (Green Earth + Hope Foundation approved)')
    console.log('  ✅ Staff 4: Ravi Mishra - pending')

    // ════════════════════════════════════════
    // STAFF APPLICATIONS (cross-NGO)
    // ════════════════════════════════════════
    console.log('\n📩 Creating Staff Applications...')

    // Staff1 (Hope Foundation) → approved for Green Earth
    await StaffApplication.create({
      userId: staff1._id,
      ngoId: ngo2._id,
      status: 'approved',
      message: 'I cover Delhi region and can help with environmental reports for Mumbai area.',
      reviewedBy: manager2._id,
      reviewedAt: new Date(),
      reviewNote: 'Approved - good coverage in Delhi area',
    })
    console.log('  ✅ Staff1 → Green Earth: APPROVED')

    // Staff2 (Hope Foundation) → pending for Green Earth
    await StaffApplication.create({
      userId: staff2._id,
      ngoId: ngo2._id,
      status: 'pending',
      message: 'I want to help with environmental reports in Mumbai.',
    })
    console.log('  ⏳ Staff2 → Green Earth: PENDING')

    // Staff3 (Green Earth) → approved for Hope Foundation
    await StaffApplication.create({
      userId: staff3._id,
      ngoId: ngo1._id,
      status: 'approved',
      message: 'I cover Mumbai but can also help with Delhi reports.',
      reviewedBy: manager1._id,
      reviewedAt: new Date(),
      reviewNote: 'Welcome aboard!',
    })
    console.log('  ✅ Staff3 → Hope Foundation: APPROVED')

    // Staff1 (Hope Foundation) → rejected by Seva Karnataka (for demo)
    await StaffApplication.create({
      userId: staff1._id,
      ngoId: ngo3._id,
      status: 'rejected',
      message: 'Would like to help in Bangalore area.',
      reviewedBy: manager3._id,
      reviewedAt: new Date(),
      reviewNote: 'NGO not yet approved, cannot accept staff.',
    })
    console.log('  ❌ Staff1 → Seva Karnataka: REJECTED')

    // ════════════════════════════════════════
    // VOLUNTEERS
    // ════════════════════════════════════════
    console.log('\n🙋 Creating Volunteers...')

    const volunteersData = [
      { email: 'vol1@gmail.com', fullName: 'Pooja Nair', phone: '+91-9876543040', ngo: ngo1._id, zone: zone1._id, status: 'active', coords: [77.1025, 28.7041], location: 'North Delhi', skills: ['Medical', 'Counseling'], tasks: ['Health', 'Women Safety'], days: ['Mon', 'Wed', 'Fri'], time: 'morning', completed: 12, hours: 34, people: 145, rating: 4.8 },
      { email: 'vol2@gmail.com', fullName: 'Arjun Kapoor', phone: '+91-9876543041', ngo: ngo1._id, zone: zone1._id, status: 'active', coords: [77.1100, 28.7100], location: 'Civil Lines, Delhi', skills: ['Teaching', 'Technology'], tasks: ['Education'], days: ['Sat', 'Sun'], time: 'afternoon', completed: 8, hours: 22, people: 89, rating: 4.5 },
      { email: 'vol3@gmail.com', fullName: 'Sneha Reddy', phone: '+91-9876543042', ngo: ngo1._id, zone: zone2._id, status: 'active', coords: [77.1855, 28.5245], location: 'Saket, South Delhi', skills: ['Cooking', 'Logistics'], tasks: ['Food', 'Disaster Relief'], days: ['Mon', 'Tue', 'Thu'], time: 'anytime', completed: 19, hours: 56, people: 312, rating: 4.9 },
      { email: 'vol4@gmail.com', fullName: 'Manoj Tiwari', phone: '+91-9876543043', ngo: ngo1._id, zone: zone3._id, status: 'active', coords: [77.2937, 28.6275], location: 'Laxmi Nagar, East Delhi', skills: ['Driving', 'Construction'], tasks: ['Shelter'], days: ['Wed', 'Thu', 'Fri'], time: 'morning', completed: 6, hours: 18, people: 67, rating: 4.3 },
      { email: 'vol5@gmail.com', fullName: 'Divya Krishnan', phone: '+91-9876543044', ngo: ngo2._id, zone: zone4._id, status: 'active', coords: [72.8205, 18.9690], location: 'Mumbai Central', skills: ['Medical', 'Teaching'], tasks: ['Health', 'Education'], days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], time: 'morning', completed: 34, hours: 98, people: 567, rating: 5.0 },
      { email: 'vol6@gmail.com', fullName: 'Rahul Joshi', phone: '+91-9876543045', ngo: ngo2._id, zone: zone5._id, status: 'active', coords: [72.9781, 19.2183], location: 'Thane', skills: ['Photography', 'Technology'], tasks: ['Education', 'Sanitation'], days: ['Sat', 'Sun'], time: 'afternoon', completed: 4, hours: 12, people: 45, rating: 4.2 },
      { email: 'vol7@gmail.com', fullName: 'Geeta Pandey', phone: '+91-9876543046', ngo: ngo1._id, zone: zone1._id, status: 'pending', coords: [77.1200, 28.7200], location: 'Model Town', skills: ['Translation'], tasks: ['Women Safety'], days: ['Mon', 'Wed', 'Fri'], time: 'evening', completed: 0, hours: 0, people: 0, rating: 0 },
      { email: 'vol8@gmail.com', fullName: 'Karan Malhotra', phone: '+91-9876543047', ngo: ngo1._id, status: 'pending', coords: [77.2090, 28.6139], location: 'Central Delhi', skills: ['Medical', 'First Aid'], tasks: ['Health'], days: ['Sat', 'Sun'], time: 'morning', completed: 0, hours: 0, people: 0, rating: 0 },
    ]

    for (const v of volunteersData) {
      await User.create({
        email: v.email, password: 'Volunteer@123', fullName: v.fullName, phone: v.phone,
        role: getRole('volunteer')._id, roleName: 'volunteer',
        ngo: v.ngo, zone: v.zone, status: v.status,
        location: { type: 'Point', coordinates: v.coords },
        locationName: v.location, operatingRadius: 5,
        volunteerProfile: {
          skills: v.skills, taskPreferences: v.tasks, availableDays: v.days,
          availableTime: v.time, tasksCompleted: v.completed, hoursVolunteered: v.hours,
          peopleHelped: v.people, rating: v.rating,
        },
      })
      console.log(`  ✅ Volunteer: ${v.fullName} (${v.status})`)
    }

    // ════════════════════════════════════════
    // PRINT SUMMARY
    // ════════════════════════════════════════
    console.log('\n')
    console.log('═══════════════════════════════════════════════════')
    console.log('           ✅ DUMMY DATA SEEDED SUCCESSFULLY        ')
    console.log('═══════════════════════════════════════════════════')
    console.log('\n📧 LOGIN CREDENTIALS\n')

    console.log('👑 SUPER ADMIN')
    console.log('   Email:    superadmin@platform.com')
    console.log('   Password: Admin@123456')

    console.log('\n🏢 NGO MANAGERS')
    console.log('   ┌─ Hope Foundation (APPROVED)')
    console.log('   │  Email:    manager1@hopefoundation.in')
    console.log('   │  Password: Manager@123')
    console.log('   │')
    console.log('   ├─ Green Earth NGO (APPROVED)')
    console.log('   │  Email:    manager2@greenearth.in')
    console.log('   │  Password: Manager@123')
    console.log('   │')
    console.log('   └─ Seva Karnataka (PENDING)')
    console.log('      Email:    manager3@sevakarnataka.in')
    console.log('      Password: Manager@123')

    console.log('\n👥 COMMITTEE MEMBERS (Password: Committee@123)')
    console.log('   committee1@hopefoundation.in → North Delhi (active)')
    console.log('   committee2@hopefoundation.in → South Delhi (active)')
    console.log('   committee3@hopefoundation.in → East Delhi  (active)')
    console.log('   committee4@greenearth.in     → Mumbai      (active)')
    console.log('   committee5@hopefoundation.in → (pending)')

    console.log('\n📋 NGO STAFF (Password: Staff@123)')
    console.log('   staff1@hopefoundation.in → Hope Foundation + Green Earth ✅')
    console.log('   staff2@hopefoundation.in → Hope Foundation (pending Green Earth)')
    console.log('   staff3@greenearth.in     → Green Earth + Hope Foundation ✅')
    console.log('   staff4@hopefoundation.in → (pending approval)')

    console.log('\n📩 STAFF CROSS-NGO APPLICATIONS')
    console.log('   Staff1 → Green Earth:      ✅ APPROVED')
    console.log('   Staff2 → Green Earth:      ⏳ PENDING')
    console.log('   Staff3 → Hope Foundation:  ✅ APPROVED')
    console.log('   Staff1 → Seva Karnataka:   ❌ REJECTED')

    console.log('\n🙋 VOLUNTEERS (Password: Volunteer@123)')
    console.log('   vol1@gmail.com → Pooja Nair      (active)')
    console.log('   vol2@gmail.com → Arjun Kapoor    (active)')
    console.log('   vol3@gmail.com → Sneha Reddy     (active)')
    console.log('   vol4@gmail.com → Manoj Tiwari    (active)')
    console.log('   vol5@gmail.com → Divya Krishnan  (active)')
    console.log('   vol6@gmail.com → Rahul Joshi     (active)')
    console.log('   vol7@gmail.com → Geeta Pandey    (pending)')
    console.log('   vol8@gmail.com → Karan Malhotra  (pending)')

    console.log('\n═══════════════════════════════════════════════════\n')

    process.exit(0)

  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

seedDummyData()