require('dotenv').config()

const express   = require('express')
const cors      = require('cors')
const connectDB = require('./config/db')

const app = express()

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5100',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true)

      // Allow all vercel.app domains
      if (origin.endsWith('.vercel.app')) return callback(null, true)

      // Check allowed list
      if (allowedOrigins.includes(origin)) return callback(null, true)

      callback(new Error(`CORS: ${origin} not allowed`))
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.options('*', cors())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Static Files (Local dev only) ─────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const path = require('path')
  app.use('/uploads', require('express').static(path.join(__dirname, 'uploads')))
}

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:      'OK',
    message:     'Server is running',
    database:    'MongoDB Atlas',
    environment: process.env.NODE_ENV || 'development',
    time:        new Date().toISOString(),
  })
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth.routes'))
app.use('/api/super-admin', require('./routes/superAdmin'))
app.use('/api/ngo-manager', require('./routes/ngoManager'))
app.use('/api/upload',      require('./routes/upload'))
app.use('/api/reports',     require('./routes/report'))
app.use('/api/chat',        require('./routes/chat'))
app.use('/api/volunteers',  require('./routes/volunteer.routes'))
app.use('/api/tasks',       require('./routes/task.routes'))
app.use('/api/assignments', require('./routes/workerAssignment.routes'))

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  })
})

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err.message)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// ── Initialize DB ─────────────────────────────────────────────
const initializeApp = async () => {
  try {
    await connectDB()

    // Register all models
    require('./models/Role')
    require('./models/NGO')
    require('./models/Zone')
    require('./models/User')
    require('./models/Report')
    require('./models/Task')
    require('./models/VolunteerProfile')
    require('./models/VolunteerApplication')
    require('./models/ChatMessage')
    require('./models/WorkerAssignment')

    console.log('✅ All models registered')
  } catch (error) {
    console.error('❌ App initialization failed:', error.message)
    if (process.env.NODE_ENV !== 'production') process.exit(1)
  }
}

// ── Start ─────────────────────────────────────────────────────
initializeApp()

// Local dev server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`📡 Health: http://localhost:${PORT}/api/health`)
  })
}

// Export for Vercel serverless
module.exports = app