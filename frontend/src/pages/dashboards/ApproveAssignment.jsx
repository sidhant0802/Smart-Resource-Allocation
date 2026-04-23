import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { assignmentApi } from '../api/assignmentApi'

export default function ApproveAssignment() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    handleApprove()
  }, [token])

  const handleApprove = async () => {
    try {
      setLoading(true)
      const res = await assignmentApi.volunteerApprove(token)
      setResult(res)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        {loading ? (
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Processing your approval...</p>
          </div>
        ) : error ? (
          <div>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Approval Failed
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/dashboard/volunteer')}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Go to Dashboard
            </button>
          </div>
        ) : result ? (
          <div>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">
              Approved!
            </h2>
            <p className="text-gray-600 mb-4">
              {result.message}
            </p>
            <div className="bg-green-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-700">
                <strong>Progress:</strong> {result.progress}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Status:{' '}
                <span className="font-bold text-green-600">
                  {result.assignmentStatus}
                </span>
              </p>
              {result.isFullyAssigned && (
                <p className="text-sm text-green-700 mt-2 font-bold">
                  🎉 All volunteers approved! Task is now active.
                </p>
              )}
            </div>
            <button
              onClick={() => navigate('/dashboard/volunteer')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Go to Dashboard
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}