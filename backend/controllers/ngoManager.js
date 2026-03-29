const User = require('../models/User')
const NGO  = require('../models/NGO')
const Zone = require('../models/Zone')

// ── Get NGO Manager Dashboard Data ──
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id

    // Find the NGO managed by this user
    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found for this manager' })
    }

    // Get zones under this NGO
    const zones = await Zone.find({ ngo: ngo._id })
      .populate('committeeMembers', 'fullName email phone locationName status')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })

    // Get all users under this NGO
    const committeeMembers = await User.find({
      ngo: ngo._id,
      roleName: 'committee_member',
    }).select('fullName email phone locationName status zone createdAt')

    const ngoStaff = await User.find({
      ngo: ngo._id,
      roleName: 'ngo_staff',
    }).select('fullName email phone locationName status zone createdAt')

    const volunteers = await User.find({
      ngo: ngo._id,
      roleName: 'volunteer',
    }).select('fullName email phone locationName status volunteerProfile zone createdAt')

    // Pending approvals (committee members and staff waiting for approval)
    const pendingCommittee = await User.find({
      ngo: ngo._id,
      roleName: 'committee_member',
      status: 'pending',
    }).select('fullName email phone locationName createdAt')

    const pendingStaff = await User.find({
      ngo: ngo._id,
      roleName: 'ngo_staff',
      status: 'pending',
    }).select('fullName email phone locationName createdAt')

    // Stats
    const stats = {
      totalZones:            zones.length,
      activeZones:           zones.filter(z => z.status === 'active').length,
      totalCommitteeMembers: committeeMembers.length,
      activeCommittee:       committeeMembers.filter(c => c.status === 'active').length,
      totalStaff:            ngoStaff.length,
      activeStaff:           ngoStaff.filter(s => s.status === 'active').length,
      totalVolunteers:       volunteers.length,
      activeVolunteers:      volunteers.filter(v => v.status === 'active').length,
      pendingApprovals:      pendingCommittee.length + pendingStaff.length,
    }

    res.json({
      success: true,
      ngo,
      stats,
      zones,
      committeeMembers,
      ngoStaff,
      volunteers,
      pendingCommittee,
      pendingStaff,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Failed to load dashboard' })
  }
}

// ── Create Zone ──
exports.createZone = async (req, res) => {
  try {
    const userId = req.user._id
    const {
      name, description, latitude, longitude,
      locationName, city, state, country, pincode,
    } = req.body

    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found' })
    }

    if (ngo.status !== 'approved') {
      return res.status(403).json({ error: 'NGO is not approved yet' })
    }

    if (!name) {
      return res.status(400).json({ error: 'Zone name is required' })
    }

    const zone = await Zone.create({
      name,
      description:  description  || '',
      ngo:          ngo._id,
      latitude:     parseFloat(latitude)  || 0,
      longitude:    parseFloat(longitude) || 0,
      locationName: locationName || '',
      city:         city         || '',
      state:        state        || '',
      country:      country      || 'India',
      pincode:      pincode      || '',
      createdBy:    userId,
      status:       'active',
    })

    // Update NGO zone count
    await NGO.findByIdAndUpdate(ngo._id, {
      $inc: { totalZones: 1 },
    })

    res.status(201).json({
      success: true,
      message: `Zone "${name}" created successfully`,
      zone,
    })
  } catch (error) {
    console.error('Create zone error:', error)
    res.status(500).json({ error: 'Failed to create zone' })
  }
}

// ── Delete Zone ──
exports.deleteZone = async (req, res) => {
  try {
    const userId   = req.user._id
    const { zoneId } = req.params

    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found' })
    }

    const zone = await Zone.findOne({ _id: zoneId, ngo: ngo._id })
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' })
    }

    await Zone.findByIdAndDelete(zoneId)

    await NGO.findByIdAndUpdate(ngo._id, {
      $inc: { totalZones: -1 },
    })

    res.json({
      success: true,
      message: `Zone "${zone.name}" deleted`,
    })
  } catch (error) {
    console.error('Delete zone error:', error)
    res.status(500).json({ error: 'Failed to delete zone' })
  }
}

// ── Appoint Committee Member (approve pending user) ──
exports.approveCommitteeMember = async (req, res) => {
  try {
    const userId   = req.user._id
    const { memberId } = req.params
    const { zoneId }   = req.body

    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found' })
    }

    const member = await User.findOne({
      _id:      memberId,
      ngo:      ngo._id,
      roleName: 'committee_member',
    })
    if (!member) {
      return res.status(404).json({ error: 'Committee member not found' })
    }

    // Validate zone exists under this NGO
    if (zoneId) {
      const zone = await Zone.findOne({ _id: zoneId, ngo: ngo._id })
      if (!zone) {
        return res.status(404).json({ error: 'Zone not found under your NGO' })
      }

      // Assign zone
      member.zone = zoneId
      // Add to zone's committee members
      await Zone.findByIdAndUpdate(zoneId, {
        $addToSet: { committeeMembers: memberId },
      })
    }

    member.status = 'active'
    member.committeeProfile = {
      ...member.committeeProfile,
      appointedBy: userId,
      appointedAt: new Date(),
    }
    await member.save()

    res.json({
      success: true,
      message: `${member.fullName} approved as committee member`,
    })
  } catch (error) {
    console.error('Approve committee error:', error)
    res.status(500).json({ error: 'Failed to approve committee member' })
  }
}

// ── Decline Committee Member or Staff ──
exports.declineUser = async (req, res) => {
  try {
    const userId   = req.user._id
    const { memberId } = req.params

    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found' })
    }

    const member = await User.findOne({
      _id: memberId,
      ngo: ngo._id,
    })
    if (!member) {
      return res.status(404).json({ error: 'User not found' })
    }

    member.status = 'suspended'
    await member.save()

    res.json({
      success: true,
      message: `${member.fullName} has been declined`,
    })
  } catch (error) {
    console.error('Decline error:', error)
    res.status(500).json({ error: 'Failed to decline user' })
  }
}

// ── Approve Staff ──
exports.approveStaff = async (req, res) => {
  try {
    const userId   = req.user._id
    const { memberId } = req.params
    const { zoneId }   = req.body

    const ngo = await NGO.findOne({ managedBy: userId })
    if (!ngo) {
      return res.status(404).json({ error: 'No NGO found' })
    }

    const staff = await User.findOne({
      _id:      memberId,
      ngo:      ngo._id,
      roleName: 'ngo_staff',
    })
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' })
    }

    if (zoneId) {
      staff.zone = zoneId
    }

    staff.status = 'active'
    staff.staffProfile = {
      ...staff.staffProfile,
      appointedBy: userId,
      appointedAt: new Date(),
    }
    await staff.save()

    res.json({
      success: true,
      message: `${staff.fullName} approved as NGO staff`,
    })
  } catch (error) {
    console.error('Approve staff error:', error)
    res.status(500).json({ error: 'Failed to approve staff' })
  }
}