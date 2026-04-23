import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { assignmentApi } from '../api/assignmentApi'

export default function RejectAssignment() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [reason, setReason] = useState('')

  const handleReject = async () => {
    setLoading(true)
    try {
      const res = await assignmentApi.volunteerReject(token, {
        reason,
      })
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {result ? (
          <div className="text-center">
            <div className="text-5xl mb-4">👍</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Got It!
            </h2>
            <p className="text-gray-600 mb-6">
              We'll find another volunteer for this task.
            </p>
            <div className="bg-orange-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700">
                {result.message}
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/volunteer')}
              className="w-full px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Unable to Help?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Let us know why so we can improve future opportunities.
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional: Tell us why you can't help (e.g., Schedule conflict, Health issue)"
              rows={4}
              className="w-full px-4 py-2 border rounded-lg text-sm mb-4 resize-none focus:ring-2 focus:ring-orange-500"
            />

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/dashboard/volunteer')}
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50"
              >
                Keep It
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-red-700"
              >
                {loading ? '⏳...' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}