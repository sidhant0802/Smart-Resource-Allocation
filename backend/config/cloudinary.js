const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder        = 'ngo/others'
    let resource_type = 'auto'

    if (file.mimetype.includes('pdf')) {
      folder        = 'ngo/pdfs'
      resource_type = 'raw'
    } else if (file.mimetype.includes('image')) {
      folder        = 'ngo/images'
      resource_type = 'image'
    } else if (file.mimetype.includes('audio')) {
      folder        = 'ngo/audio'
      resource_type = 'video'
    }

    return {
      folder,
      resource_type,
      public_id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    }
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4',
  ]
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('File type not supported'), false)
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
})

module.exports = { cloudinary, upload }