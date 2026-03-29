const fs       = require('fs')
const pdfParse = require('pdf-parse')

// ── Extract from PDF ─────────────────────────────────────────
const extractFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath)
    const data       = await pdfParse(dataBuffer)
    return {
      text:    (data.text || '').trim(),
      pages:   data.numpages,
      success: true,
    }
  } catch (err) {
    console.error('PDF extraction error:', err.message)
    return { text: '', success: false, error: err.message }
  }
}

// ── Extract from Image (OCR) ─────────────────────────────────
const extractFromImage = async (filePath) => {
  try {
    const Tesseract = require('tesseract.js')
    const result    = await Tesseract.recognize(filePath, 'eng', {
      logger: () => {},
    })
    const text = (result.data.text || '').trim()
    return { text, success: true }
  } catch (err) {
    console.error('OCR error:', err.message)
    return { text: '', success: false, error: err.message }
  }
}

// ── Main extractor ───────────────────────────────────────────
const extractText = async (fileType, filePath, rawText = '') => {
  switch (fileType) {
    case 'pdf':
      return extractFromPDF(filePath)
    case 'image':
      return { text: rawText, success: true }
      // For images, Gemini Vision handles analysis directly
    case 'voice':
    case 'text':
    default:
      return { text: rawText || '', success: true }
  }
}

module.exports = { extractText }