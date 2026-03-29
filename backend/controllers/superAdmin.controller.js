const User = require('../models/User')
const NGO  = require('../models/NGO')

exports.getStats = async (req, res) => {
  try {
    const totalNgos   = await NGO.countDocuments()
    const pendingNgos = await NGO.countDocuments({ status: 'pending' })
    const activeNgos  = await NGO.countDocuments({ status: 'approved' })
    const totalUsers  = await User.countDocuments({
      roleName: { $ne: 'super_admin' },
    })

    res.json({
      success: true,
      stats: { totalNgos, pendingNgos, activeNgos, totalUsers },
    })
  } catch (error) {
    console.error('Stats error:', error)
    res.status(500).json({ error: 'Failed to get stats' })
  }
}

exports.getAllNgos = async (req, res) => {
  try {
    const ngos = await NGO.find()
      .populate('managedBy', 'fullName email phone locationName')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      count:   ngos.length,
      ngos,
    })
  } catch (error) {
    console.error('Get NGOs error:', error)
    res.status(500).json({ error: 'Failed to fetch NGOs' })
  }
}

exports.approveNgo = async (req, res) => {
  try {
    const { ngoId } = req.params

    const ngo = await NGO.findById(ngoId)
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' })
    }

    if (ngo.status === 'approved') {
      return res.status(400).json({ error: 'NGO already approved' })
    }

    ngo.status     = 'approved'
    ngo.approvedBy = req.user._id
    ngo.approvedAt = new Date()
    await ngo.save()

    if (ngo.managedBy) {
      await User.findByIdAndUpdate(ngo.managedBy, {
        status: 'active',
      })
    }

    res.json({
      success: true,
      message: `NGO "${ngo.name}" has been approved`,
      ngo,
    })
  } catch (error) {
    console.error('Approve error:', error)
    res.status(500).json({ error: 'Failed to approve NGO' })
  }
}

exports.declineNgo = async (req, res) => {
  try {
    const { ngoId }  = req.params
    const { reason } = req.body

    const ngo = await NGO.findById(ngoId)
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' })
    }

    ngo.status        = 'declined'
    ngo.declineReason = reason || 'No reason provided'
    ngo.approvedBy    = req.user._id
    ngo.approvedAt    = new Date()
    await ngo.save()

    if (ngo.managedBy) {
      await User.findByIdAndUpdate(ngo.managedBy, {
        status: 'suspended',
      })
    }

    res.json({
      success: true,
      message: `NGO "${ngo.name}" has been declined`,
      ngo,
    })
  } catch (error) {
    console.error('Decline error:', error)
    res.status(500).json({ error: 'Failed to decline NGO' })
  }
}

exports.suspendNgo = async (req, res) => {
  try {
    const { ngoId }  = req.params
    const { reason } = req.body

    const ngo = await NGO.findById(ngoId)
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' })
    }

    ngo.status        = 'suspended'
    ngo.declineReason = reason || ''
    await ngo.save()

    if (ngo.managedBy) {
      await User.findByIdAndUpdate(ngo.managedBy, {
        status: 'suspended',
      })
    }

    res.json({
      success: true,
      message: `NGO "${ngo.name}" has been suspended`,
      ngo,
    })
  } catch (error) {
    console.error('Suspend error:', error)
    res.status(500).json({ error: 'Failed to suspend NGO' })
  }
}