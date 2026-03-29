require('dotenv').config()

const express   = require('express')
const cors      = require('cors')
const connectDB = require('./config/db')

connectDB()

const app = express()

// ── CORS ──
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5100',
    'http://localhost:3000',
  ],
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.options('*', cors())

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status:   'OK',
    message:  'Server is running',
    database: 'MongoDB',
    time:     new Date().toISOString(),
  })
})

// Routes
app.use('/api/auth',        require('./routes/auth.routes'))
app.use('/api/super-admin', require('./routes/superAdmin'))
app.use('/api/ngo-manager', require('./routes/ngoManager'))

// Serve uploaded files
app.use('/uploads', express.static('uploads'))
// Add to routes section:
app.use('/api/upload',  require('./routes/upload'))
app.use('/api/reports', require('./routes/report'))
app.use('/api/chat',    require('./routes/chat'))
// Routes
app.use('/api/auth',        require('./routes/auth.routes'))
app.use('/api/super-admin', require('./routes/superAdmin'))
app.use('/api/ngo-manager', require('./routes/ngoManager'))
app.use('/api/upload',      require('./routes/upload'))
app.use('/api/reports',     require('./routes/report'))

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📡 Health: http://localhost:${PORT}/api/health`)
})