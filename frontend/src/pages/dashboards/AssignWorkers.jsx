import { useState, useEffect } from 'react'
import { assignmentApi } from '../../api/assignmentApi'

export default function AssignWorkers({
  report,
  task,
  onClose,
  onSuccess,
  approvedVolunteers,
}) {
  const [step, setStep] = useState(1) // 1: Setup, 2: Assign volunteers
  const [assignmentData, setAssignmentData] = useState({
    totalSlotsNeeded: 3,
    durationDays: 7,
    startDate: new Date().toISOString().split('T')[0],
  })
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [selectedVolunteer, setSelectedVolunteer] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // ── Step 1: Create Assignment ─────────────────────────────
  const handleCreateAssignment = async () => {
    if (
      !assignmentData.totalSlotsNeeded ||
      !assignmentData.durationDays ||
      !assignmentData.startDate
    ) {
      alert('Please fill all required fields')
      return
    }

    setLoading(true)
    try {
      const res = await assignmentApi.createAssignment({
        reportId: report._id,
        taskId: task._id,
        totalSlotsNeeded: assignmentData.totalSlotsNeeded,
        durationDays: assignmentData.durationDays,
        startDate: assignmentData.startDate,
      })

      setAssignment(res.assignment)
      setStep(2)
      setSuccessMsg('✅ Assignment created! Now assign volunteers.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Assign Volunteer to Slot ──────────────────────
  const handleAssignVolunteer = async () => {
    if (!selectedSlot || !selectedVolunteer) {
      alert('Please select both a slot and volunteer')
      return
    }

    setAssignLoading(true)
    try {
      const res = await assignmentApi.assignVolunteer(assignment._id, {
        volunteerId: selectedVolunteer._id,
        slotNumber: selectedSlot.slotNumber,
      })

      setSuccessMsg(`✅ Email sent to ${selectedVolunteer.fullName}`)
      setAssignment(res.assignment)
      setSelectedVolunteer(null)
      setSelectedSlot(null)
      setTimeout(() => setSuccessMsg(''), 3000)

      // Check if all filled
      if (res.isFullyAssigned) {
        setTimeout(() => {
          alert(
            '🎉 All slots filled! Assignment is now active.'
          )
          onSuccess()
        }, 1500)
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setAssignLoading(false)
    }
  }

  const getAvailableSlots = () => {
    if (!assignment) return []
    return assignment.slots.filter((s) => s.status === 'pending_assignment')
  }

  const getAvailableVolunteers = () => {
    if (!assignment) return []
    const assignedIds = assignment.slots
      .filter((s) => s.volunteerId)
      .map((s) => s.volunteerId._id || s.volunteerId)
    return approvedVolunteers.filter(
      (v) => !assignedIds.includes(v._id)
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold text-white">
              🎯 Assign Active Workers
            </h3>
            <p className="text-xs text-purple-100 mt-1">
              Step {step} of 2 • {report.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white text-2xl hover:opacity-80"
          >
            ×
          </button>
        </div>

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-green-100 border-l-4 border-green-500 text-green-700 text-sm rounded animate-pulse">
            {successMsg}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* ══ STEP 1: Setup ══ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-800">
                  <strong>📋 Report:</strong> {report.title}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>✅ Task:</strong> {task.title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Workers Needed *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setAssignmentData({
                        ...assignmentData,
                        totalSlotsNeeded:
                          assignmentData.totalSlotsNeeded - 1,
                      })
                    }
                    disabled={assignmentData.totalSlotsNeeded <= 1}
                    className="px-3 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={assignmentData.totalSlotsNeeded}
                    onChange={(e) =>
                      setAssignmentData({
                        ...assignmentData,
                        totalSlotsNeeded: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 px-4 py-2 border rounded-lg text-center text-xl font-bold focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() =>
                      setAssignmentData({
                        ...assignmentData,
                        totalSlotsNeeded:
                          assignmentData.totalSlotsNeeded + 1,
                      })
                    }
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Example: 3 workers needed = Slot 1/3, 2/3, 3/3
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (Days) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setAssignmentData({
                        ...assignmentData,
                        durationDays: assignmentData.durationDays - 1,
                      })
                    }
                    disabled={assignmentData.durationDays <= 1}
                    className="px-3 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={assignmentData.durationDays}
                    onChange={(e) =>
                      setAssignmentData({
                        ...assignmentData,
                        durationDays: parseInt(e.target.value),
                      })
                    }
                    className="flex-1 px-4 py-2 border rounded-lg text-center text-xl font-bold focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() =>
                      setAssignmentData({
                        ...assignmentData,
                        durationDays: assignmentData.durationDays + 1,
                      })
                    }
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={assignmentData.startDate}
                  onChange={(e) =>
                    setAssignmentData({
                      ...assignmentData,
                      startDate: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  End Date:{' '}
                  {new Date(
                    new Date(assignmentData.startDate).getTime() +
                      assignmentData.durationDays * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  <strong>📌 Summary:</strong>
                </p>
                <ul className="text-sm text-purple-700 mt-2 space-y-1">
                  <li>
                    ✓ Need {assignmentData.totalSlotsNeeded} workers
                  </li>
                  <li>✓ For {assignmentData.durationDays} days</li>
                  <li>
                    ✓ Starting{' '}
                    {new Date(
                      assignmentData.startDate
                    ).toLocaleDateString()}
                  </li>
                  <li>
                    ✓ Email invitations will be sent automatically
                  </li>
                  <li>
                    ✓ Each worker must approve before task starts
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAssignment}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-purple-700"
                >
                  {loading
                    ? '⏳ Creating...'
                    : '→ Next: Assign Workers'}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2: Assign Volunteers ══ */}
          {step === 2 && assignment && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800">
                    Assignment Progress
                  </span>
                  <span className="text-2xl font-bold text-purple-600">
                    {assignment.progress}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${(parseInt(assignment.progress.split('/')[0]) / parseInt(assignment.progress.split('/')[1])) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {assignment.filledSlots} out of{' '}
                  {assignment.totalSlotsNeeded} slots filled
                </p>
              </div>

              {/* Current Assignments */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                  📋 Current Assignments
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {assignment.slots.map((slot) => (
                    <div
                      key={slot.slotNumber}
                      className={`p-3 rounded-lg border-2 ${
                        slot.status === 'approved'
                          ? 'bg-green-50 border-green-500'
                          : slot.status === 'assignment_sent'
                          ? 'bg-blue-50 border-blue-300'
                          : slot.status === 'pending_assignment'
                          ? 'bg-gray-50 border-gray-300'
                          : 'bg-red-50 border-red-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">
                            Slot {slot.slotNumber}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-bold ${
                              slot.status === 'approved'
                                ? 'bg-green-200 text-green-800'
                                : slot.status === 'assignment_sent'
                                ? 'bg-blue-200 text-blue-800'
                                : slot.status === 'pending_assignment'
                                ? 'bg-gray-200 text-gray-800'
                                : 'bg-red-200 text-red-800'
                            }`}
                          >
                            {slot.status === 'approved'
                              ? '✅ Approved'
                              : slot.status === 'assignment_sent'
                              ? '📧 Invited'
                              : slot.status === 'pending_assignment'
                              ? '⏳ Empty'
                              : '❌ Rejected'}
                          </span>
                        </div>
                      </div>

                      {slot.volunteerId && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-800">
                            {slot.fullName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {slot.email}
                          </p>
                          {slot.status === 'assignment_sent' && (
                            <p className="text-xs text-blue-600 mt-1">
                              ⏰ Waiting for response...
                            </p>
                          )}
                          {slot.approvalResponseAt && (
                            <p className="text-xs text-gray-400">
                              Responded:{' '}
                              {new Date(
                                slot.approvalResponseAt
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Assign Form */}
              {getAvailableSlots().length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-800">
                    🎯 Assign Next Worker
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Empty Slot
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {getAvailableSlots().map((slot) => (
                        <button
                          key={slot.slotNumber}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 rounded-lg text-sm font-bold transition ${
                            selectedSlot?.slotNumber ===
                            slot.slotNumber
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Slot {slot.slotNumber}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Volunteer
                    </label>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {getAvailableVolunteers().length === 0 ? (
                        <p className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                          No more available volunteers
                        </p>
                      ) : (
                        getAvailableVolunteers().map((vol) => (
                          <button
                            key={vol._id}
                            onClick={() => setSelectedVolunteer(vol)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition ${
                              selectedVolunteer?._id === vol._id
                                ? 'bg-purple-50 border-purple-500'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <p className="font-medium text-gray-800 text-sm">
                              {vol.fullName}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-gray-500">
                                {vol.email}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                  vol.availabilityStatus === 'FREE'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {vol.availabilityStatus}
                              </span>
                            </div>
                            {vol.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {vol.skills.slice(0, 2).map((s) => (
                                  <span
                                    key={s}
                                    className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleAssignVolunteer}
                    disabled={
                      !selectedSlot ||
                      !selectedVolunteer ||
                      assignLoading
                    }
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700"
                  >
                    {assignLoading
                      ? '⏳ Sending Email...'
                      : '📧 Send Invitation Email'}
                  </button>
                </div>
              )}

              {getAvailableSlots().length === 0 && (
                <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                  <p className="text-lg font-bold text-green-700">
                    🎉 All Slots Assigned!
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Waiting for volunteers to approve...
                  </p>
                  <p className="text-xs text-green-500 mt-2">
                    Task will become active once all {assignment.totalSlotsNeeded} volunteers approve.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}