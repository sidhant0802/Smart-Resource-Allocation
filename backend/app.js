require('dotenv').config()

const express = require('express')
const cors = require('cors')
const connectDB = require('./config/db')

const app = express()

// ── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5100',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.options('*', cors())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Static Files ──────────────────────────────────────────────
app.use('/uploads', express.static('uploads'))

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    database: 'MongoDB',
    time: new Date().toISOString(),
  })
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'))
app.use('/api/super-admin',  require('./routes/superAdmin'))
app.use('/api/ngo-manager',  require('./routes/ngoManager'))
app.use('/api/upload',       require('./routes/upload'))
app.use('/api/reports',      require('./routes/report'))
app.use('/api/chat',         require('./routes/chat'))
app.use('/api/volunteers',   require('./routes/volunteer.routes'))
app.use('/api/tasks',        require('./routes/task.routes'))


// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
  })
})

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// ── Start Server AFTER DB connects ────────────────────────────
const PORT = process.env.PORT || 5000

const startServer = async () => {
  try {
    await connectDB()

    // Register all models AFTER connection
    require('./models/Role')
    require('./models/NGO')
    require('./models/Zone')
    require('./models/User')
    require('./models/Report')
    require('./models/Task')
    require('./models/VolunteerProfile')
    require('./models/VolunteerApplication')
    require('./models/ChatMessage')

    console.log('✅ All models registered')

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`📡 Health: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()