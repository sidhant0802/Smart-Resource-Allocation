import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { uploadApi, chatApi } from '../../api/authApi'  // ✅ single import

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-l-red-500',    label: '🔴 CRITICAL',  bar: 'bg-red-500',    score: 'text-red-600' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-500', label: '🟠 HIGH',      bar: 'bg-orange-500', score: 'text-orange-600' },
  medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-l-yellow-500', label: '🟡 MEDIUM',    bar: 'bg-yellow-500', score: 'text-yellow-600' },
  low:      { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-l-green-500',  label: '🟢 LOW',       bar: 'bg-green-500',  score: 'text-green-600' },
  info:     { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-l-gray-300',   label: '⚪ INFO',      bar: 'bg-gray-400',   score: 'text-gray-600' },
}

export default function NgoStaffDashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const [activeTab, setActiveTab]           = useState('upload')
  const [myReports, setMyReports]           = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Upload form
  const [uploadType, setUploadType]               = useState(null)
  const [file, setFile]                           = useState(null)
  const [textInput, setTextInput]                 = useState('')
  const [title, setTitle]                         = useState('')
  const [description, setDescription]             = useState('')
  const [uploading, setUploading]                 = useState(false)
  const [uploadedReportId, setUploadedReportId]   = useState(null)
  const [polledReport, setPolledReport]           = useState(null)
  const [polling, setPolling]                     = useState(false)

  // Voice
  const [recording, setRecording] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const recognitionRef            = useRef(null)

  // Visibility
  const [visibilityLoading, setVisibilityLoading] = useState(null)

  // ✅ Chat states — INSIDE component
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput]       = useState('')
  const [chatLoading, setChatLoading]   = useState(false)
  const [showChat, setShowChat]         = useState(false)
  const chatEndRef                      = useRef(null)

  useEffect(() => {
    if (activeTab === 'reports') fetchMyReports()
  }, [activeTab])

  const fetchMyReports = async () => {
    setLoadingReports(true)
    try {
      const res = await uploadApi.getMyReports()
      setMyReports(res.reports || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReports(false)
    }
  }

  const pollStatus = (reportId) => {
    setPolling(true)
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await uploadApi.getStatus(reportId)
        if (res.report.status === 'analyzed') {
          clearInterval(interval)
          setPolling(false)
          setPolledReport(res.report)
          setShowChat(true)      // ✅ auto-open chat after analysis
          setChatMessages([])    // ✅ reset chat for new report
        }
      } catch (err) {
        console.error(err)
      }
      if (attempts >= 30) {
        clearInterval(interval)
        setPolling(false)
      }
    }, 2000)
  }

  // ✅ Chat function — INSIDE component
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !polledReport) return

    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const res = await chatApi.sendMessage({
        reportId: polledReport._id,
        message:  userMsg,
      })

      setChatMessages(prev => [
        ...prev,
        {
          role:           'assistant',
          content:        res.message,
          recommendation: res.recommendation,
          confidence:     res.confidence,
        }
      ])

      // Auto-highlight send button if AI recommends sending
      if (res.recommendation === 'send' && polledReport.visibility !== 'sent') {
        console.log('AI recommends sending this report')
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I am unavailable right now.' }
      ])
    } finally {
      setChatLoading(false)
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleUpload = async () => {
    if (!uploadType) return alert('Select upload type')
    if (!title.trim()) return alert('Enter a title')

    const formData = new FormData()
    formData.append('title', title)
    formData.append('visibility', 'draft')

    if (uploadType === 'text') {
      if (!textInput.trim()) return alert('Enter text')
      formData.append('description', textInput)
    } else if (uploadType === 'voice') {
      if (!voiceText.trim()) return alert('Record voice first')
      formData.append('voiceText', voiceText)
      formData.append('description', voiceText)
    } else {
      if (!file) return alert('Select a file')
      formData.append('file', file)
      if (description) formData.append('description', description)
    }

    setUploading(true)
    setPolledReport(null)
    setShowChat(false)
    setChatMessages([])

    try {
      const res = await uploadApi.uploadFile(formData)
      setUploadedReportId(res.reportId)
      setUploading(false)
      pollStatus(res.reportId)
    } catch (err) {
      setUploading(false)
      alert('Upload failed: ' + err.message)
    }
  }

  const handleVisibility = async (reportId, visibility) => {
    setVisibilityLoading(reportId)
    try {
      await uploadApi.updateVisibility(reportId, visibility)
      if (polledReport?._id === reportId) {
        setPolledReport(prev => ({ ...prev, visibility }))
      }
      if (activeTab === 'reports') fetchMyReports()
      else setMyReports(prev =>
        prev.map(r => r._id === reportId ? { ...r, visibility } : r)
      )
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setVisibilityLoading(null)
    }
  }

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return alert('Use Chrome for voice recording')
    }
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-IN'
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setVoiceText(t)
    }
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const resetForm = () => {
    setUploadType(null)
    setFile(null)
    setTextInput('')
    setVoiceText('')
    setTitle('')
    setDescription('')
    setPolledReport(null)
    setUploadedReportId(null)
    setShowChat(false)
    setChatMessages([])
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const sev = (l) => SEVERITY_CONFIG[l] || SEVERITY_CONFIG.info

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📋</span>
          <div>
            <h1 className="font-bold text-gray-800">NGO Staff</h1>
            <p className="text-xs text-gray-500">{user?.fullName}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 font-medium">
          Logout
        </button>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex">
          {[
            { key: 'upload',  label: '📤 Upload Report' },
            { key: 'reports', label: '📋 My Reports'    },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={activeTab === t.key
                ? 'px-5 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600'
                : 'px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">

        {/* ══ UPLOAD TAB ══ */}
        {activeTab === 'upload' && (
          <div className="space-y-5">

            {/* AI Result Card */}
            {polledReport && (
              <div className={`rounded-2xl border-2 overflow-hidden ${sev(polledReport.analysis?.severityLevel).border.replace('border-l-', 'border-')}`}>

                {/* Header */}
                <div className={`p-4 ${sev(polledReport.analysis?.severityLevel).bg} flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">🤖 Gemini AI Analysis Complete</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Model: {polledReport.analysis?.model || 'gemini-1.5-flash'}
                      {polledReport.analysis?.processingTime &&
                        ` • ${(polledReport.analysis.processingTime / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                  <button onClick={resetForm}
                    className="text-xs text-gray-500 hover:text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
                    New Report
                  </button>
                </div>

                <div className="bg-white p-5 space-y-4">

                  {/* Score + Severity */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Urgency Score</p>
                      <p className={`text-3xl font-bold mt-1 ${sev(polledReport.analysis?.severityLevel).score}`}>
                        {polledReport.analysis?.urgencyScore || 0}
                      </p>
                      <p className="text-xs text-gray-400">/ 100</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Severity</p>
                      <p className={`text-sm font-bold mt-2 ${sev(polledReport.analysis?.severityLevel).text}`}>
                        {sev(polledReport.analysis?.severityLevel).label}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">Category</p>
                      <p className="text-sm font-bold mt-2 text-gray-800">
                        {polledReport.analysis?.category || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Urgency Level</span>
                      <span>{polledReport.analysis?.urgencyScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full transition-all ${sev(polledReport.analysis?.severityLevel).bar}`}
                        style={{ width: `${polledReport.analysis?.urgencyScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Immediate Risk */}
                  {polledReport.analysis?.immediateRisk && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                      <span className="text-red-500 text-xl">⚠️</span>
                      <p className="text-red-700 text-sm font-medium">
                        IMMEDIATE RISK DETECTED — Urgent intervention required
                      </p>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className={`rounded-xl p-4 ${sev(polledReport.analysis?.severityLevel).bg}`}>
                    <p className="text-xs font-semibold text-gray-600 mb-1">🤖 AI Summary</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{polledReport.analysis?.summary}</p>
                  </div>

                  {/* Detailed Analysis */}
                  {polledReport.analysis?.detailedAnalysis && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-600 mb-1">📊 Detailed Analysis</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{polledReport.analysis.detailedAnalysis}</p>
                    </div>
                  )}

                  {/* Key Problems */}
                  {polledReport.analysis?.keyProblems?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">🔍 Key Problems Identified</p>
                      <ul className="space-y-1">
                        {polledReport.analysis.keyProblems.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-red-500 mt-0.5">•</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {polledReport.analysis?.suggestedActions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">✅ Suggested Actions</p>
                      <ul className="space-y-1">
                        {polledReport.analysis.suggestedActions.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-500 mt-0.5">→</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Meta Tags */}
                  <div className="flex flex-wrap gap-2">
                    {polledReport.analysis?.keywords?.map(kw => (
                      <span key={kw} className="bg-blue-50 text-blue-600 text-xs px-2.5 py-1 rounded-full">{kw}</span>
                    ))}
                    {polledReport.analysis?.affectedPeople && (
                      <span className="bg-red-50 text-red-600 text-xs px-2.5 py-1 rounded-full">
                        👥 ~{polledReport.analysis.affectedPeople} people
                      </span>
                    )}
                    {polledReport.analysis?.affectedArea && (
                      <span className="bg-purple-50 text-purple-600 text-xs px-2.5 py-1 rounded-full">
                        📍 {polledReport.analysis.affectedArea}
                      </span>
                    )}
                  </div>

                  {/* Send / Draft Decision */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3">📤 What do you want to do with this report?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleVisibility(polledReport._id, 'sent')}
                        disabled={polledReport.visibility === 'sent' || visibilityLoading === polledReport._id}
                        className={`py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          polledReport.visibility === 'sent'
                            ? 'bg-green-100 text-green-700 border-2 border-green-300 cursor-default'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {polledReport.visibility === 'sent' ? '✅ Sent to Committee' : '📤 Send to Committee'}
                      </button>
                      <button
                        onClick={() => handleVisibility(polledReport._id, 'draft')}
                        disabled={polledReport.visibility === 'draft' || visibilityLoading === polledReport._id}
                        className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                          polledReport.visibility === 'draft'
                            ? 'bg-gray-100 text-gray-600 border-2 border-gray-300 cursor-default'
                            : 'bg-gray-600 text-white hover:bg-gray-700'
                        }`}
                      >
                        📝 Keep as Draft
                      </button>
                    </div>
                    {polledReport.visibility === 'sent' && (
                      <p className="text-xs text-green-600 text-center mt-2">✅ Committee member can now see this report</p>
                    )}
                    {polledReport.visibility === 'draft' && (
                      <p className="text-xs text-gray-500 text-center mt-2">📝 Only you can see this. Send when ready.</p>
                    )}
                  </div>

                  {/* ✅ AI Chat Section */}
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      onClick={() => setShowChat(!showChat)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🤖</span>
                        <span className="font-semibold text-indigo-700 text-sm">Ask AI about this report</span>
                      </div>
                      <span className="text-indigo-500 text-xs">{showChat ? '▲ Hide' : '▼ Open Chat'}</span>
                    </button>

                    {showChat && (
                      <div className="mt-3 border border-indigo-100 rounded-xl overflow-hidden">

                        {/* Chat Messages */}
                        <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
                          {chatMessages.length === 0 && (
                            <div className="text-center text-gray-400 text-sm mt-8">
                              <p className="text-2xl mb-2">💬</p>
                              <p>Ask anything about this report</p>
                              <p className="text-xs mt-1">e.g. "Should I send this?" or "How urgent is this?"</p>
                            </div>
                          )}

                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                                msg.role === 'user'
                                  ? 'bg-indigo-600 text-white rounded-br-sm'
                                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
                              }`}>
                                <p>{msg.content}</p>
                                {msg.recommendation && (
                                  <p className={`text-xs mt-1.5 font-semibold ${
                                    msg.recommendation === 'send' ? 'text-green-400' : 'text-yellow-400'
                                  }`}>
                                    Recommendation: {msg.recommendation === 'send' ? '📤 Send it' : '📝 Keep draft'}
                                  </p>
                                )}
                                {msg.confidence && (
                                  <p className="text-xs opacity-60 mt-0.5">
                                    Confidence: {Math.round(msg.confidence * 100)}%
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}

                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="flex gap-2 p-3 bg-white border-t border-gray-100">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                            placeholder="Ask about this report..."
                            disabled={chatLoading}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !chatInput.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Polling State */}
            {polling && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8 text-center">
                <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="font-bold text-blue-800 text-lg">🤖 Gemini AI Analyzing...</p>
                <p className="text-sm text-blue-600 mt-1">Reading content • Detecting severity • Generating insights</p>
                <div className="flex justify-center gap-2 mt-4">
                  {['Extracting text', 'Understanding context', 'Scoring urgency', 'Writing summary'].map((s, i) => (
                    <span key={s} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full animate-pulse"
                      style={{ animationDelay: `${i * 0.3}s` }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Form */}
            {!polledReport && !polling && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Title *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="Brief title of the community issue"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Type *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { type: 'pdf',   icon: '📄', label: 'PDF' },
                      { type: 'image', icon: '🖼️',  label: 'Image' },
                      { type: 'voice', icon: '🎤', label: 'Voice' },
                      { type: 'text',  icon: '✏️',  label: 'Text' },
                    ].map(opt => (
                      <button key={opt.type} onClick={() => setUploadType(opt.type)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          uploadType === opt.type ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-200'
                        }`}
                      >
                        <div className="text-3xl mb-1">{opt.icon}</div>
                        <p className="text-xs font-medium text-gray-700">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {uploadType === 'pdf' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
                    <input type="file" accept=".pdf" onChange={e => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    {file && <p className="text-xs text-green-600 mt-1">✅ {file.name}</p>}
                  </div>
                )}

                {uploadType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image File</label>
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    {file && (
                      <img src={URL.createObjectURL(file)} alt="preview"
                        className="mt-2 w-full h-40 object-cover rounded-xl border border-gray-200" />
                    )}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Describe what's in the image (helps AI)
                      </label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="e.g., Flooded street, broken drainage pipe..."
                        rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                  </div>
                )}

                {uploadType === 'voice' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Voice Recording</label>
                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                      <button
                        onClick={recording ? stopRecording : startRecording}
                        className={`w-24 h-24 rounded-full text-4xl transition-all mx-auto block shadow-lg ${
                          recording ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                        }`}
                      >
                        {recording ? '⏹️' : '🎤'}
                      </button>
                      <p className="text-sm text-gray-500 mt-3">
                        {recording ? '🔴 Recording... tap to stop' : 'Tap to start recording'}
                      </p>
                    </div>
                    {voiceText && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-green-600 mb-1">✅ Transcribed:</p>
                        <p className="text-sm text-gray-800">{voiceText}</p>
                      </div>
                    )}
                  </div>
                )}

                {uploadType === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Describe the Issue *</label>
                    <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                      placeholder="Describe the community problem in detail..."
                      rows={8} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    <p className="text-xs text-gray-400 mt-1">{textInput.length} characters</p>
                  </div>
                )}

                {uploadType && (
                  <button onClick={handleUpload} disabled={uploading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2 text-base"
                  >
                    {uploading ? (
                      <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> Uploading...</>
                    ) : '🤖 Analyze with Gemini AI →'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ MY REPORTS TAB ══ */}
        {activeTab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">My Reports ({myReports.length})</h3>
              <button onClick={fetchMyReports} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>

            {loadingReports ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-3">📋</p>
                <p className="text-gray-500">No reports yet. Upload your first one!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myReports.map(report => (
                  <div key={report._id}
                    className={`bg-white rounded-2xl shadow-sm border-l-4 ${
                      report.analysis?.severityLevel === 'critical' ? 'border-l-red-500' :
                      report.analysis?.severityLevel === 'high'     ? 'border-l-orange-500' :
                      report.analysis?.severityLevel === 'medium'   ? 'border-l-yellow-500' :
                      report.analysis?.severityLevel === 'low'      ? 'border-l-green-500' :
                      'border-l-gray-300'
                    } overflow-hidden`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{report.title}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(report.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sev(report.analysis?.severityLevel).bg} ${sev(report.analysis?.severityLevel).text}`}>
                            {sev(report.analysis?.severityLevel).label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.visibility === 'sent' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            {report.visibility === 'sent' ? '📤 Sent' : '📝 Draft'}
                          </span>
                        </div>
                      </div>

                      {report.status === 'processing' ? (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                          Gemini AI analyzing...
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs text-gray-500 w-24">Urgency</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                              <div className={`h-2.5 rounded-full ${sev(report.analysis?.severityLevel).bar}`}
                                style={{ width: `${report.analysis?.urgencyScore || 0}%` }} />
                            </div>
                            <span className="text-sm font-bold text-gray-700 w-12 text-right">
                              {report.analysis?.urgencyScore || 0}/100
                            </span>
                          </div>

                          {report.analysis?.summary && (
                            <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-2">
                              {report.analysis.summary}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {report.analysis?.category && (
                              <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                                {report.analysis.category}
                              </span>
                            )}
                            {report.analysis?.keywords?.slice(0, 3).map(kw => (
                              <span key={kw} className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{kw}</span>
                            ))}
                          </div>

                          <div className="flex gap-2 pt-2 border-t border-gray-100">
                            {report.visibility !== 'sent' ? (
                              <button onClick={() => handleVisibility(report._id, 'sent')}
                                disabled={visibilityLoading === report._id}
                                className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                                {visibilityLoading === report._id ? '...' : '📤 Send to Committee'}
                              </button>
                            ) : (
                              <button onClick={() => handleVisibility(report._id, 'draft')}
                                disabled={visibilityLoading === report._id}
                                className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50">
                                {visibilityLoading === report._id ? '...' : '↩️ Move to Draft'}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}