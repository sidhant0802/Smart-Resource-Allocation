const mongoose = require('mongoose')

let isConnected = false

const connectDB = async () => {
  // Reuse existing connection (important for serverless/Vercel)
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('♻️ Reusing MongoDB connection')
    return
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:          45000,
      maxPoolSize:              10,
      bufferCommands:           false,
    })

    isConnected = true
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📦 Database: ${conn.connection.name}`)

  } catch (error) {
    isConnected = false
    console.error(`❌ MongoDB Connection Failed: ${error.message}`)
    throw error
  }
}

// Connection events
mongoose.connection.on('disconnected', () => {
  isConnected = false
  console.log('⚠️ MongoDB Disconnected')
})

mongoose.connection.on('reconnected', () => {
  isConnected = true
  console.log('✅ MongoDB Reconnected')
})

module.exports = connectDB