const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true,
    })

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📦 Database: ${conn.connection.name}`)

  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`)
    process.exit(1)
  }
}

// Connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB Disconnected')
})

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB Reconnected')
})

module.exports = connectDB