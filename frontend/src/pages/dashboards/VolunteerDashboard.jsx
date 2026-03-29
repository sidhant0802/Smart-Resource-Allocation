import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function VolunteerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4
                      flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🙋</span>
          <div>
            <h1 className="font-bold text-gray-800">Volunteer</h1>
            <p className="text-xs text-gray-500">
              📍 {user?.locationName || 'Location not set'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Hi, {user?.fullName}
          </span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm bg-red-50 text-red-600 px-4 py-2
                       rounded-lg hover:bg-red-100 font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: 'Tasks Done',
              value: user?.volunteerProfile?.tasksCompleted || 0,
              icon:  '✅',
            },
            {
              label: 'People Helped',
              value: user?.volunteerProfile?.peopleHelped || 0,
              icon:  '❤️',
            },
            {
              label: 'My Rating',
              value: user?.volunteerProfile?.rating || '—',
              icon:  '⭐',
            },
          ].map(card => (
            <div key={card.label}
                 className="bg-white rounded-2xl p-4 shadow-sm
                            border border-gray-100 text-center">
              <p className="text-2xl">{card.icon}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {card.value}
              </p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          ))}
        </div>

        {user?.volunteerProfile?.skills?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm
                          border border-gray-100 mb-4">
            <h3 className="font-semibold text-gray-800 mb-3">
              My Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {user.volunteerProfile.skills.map(s => (
                <span key={s}
                      className="bg-blue-100 text-blue-700 text-xs
                                 px-3 py-1 rounded-full font-medium">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm
                        border border-gray-100 text-center">
          <p className="text-4xl mb-2">🗺️</p>
          <p className="text-gray-500 text-sm">
            Nearby tasks will appear here once approved
          </p>
        </div>
      </div>
    </div>
  )
}