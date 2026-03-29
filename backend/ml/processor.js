const { extractText } = require('./textExtractor')
const { analyzeText } = require('./analyzer')

// ── Main processing pipeline ─────────────────────────────────
const processReport = async ({
  fileType,
  filePath,
  rawText,
  hasFile,
}) => {
  try {
    console.log(`🤖 Processing ${fileType} file...`)

    // Step 1: Extract text
    const extraction = await extractText(fileType, filePath, rawText)
    const text = extraction.text || rawText || ''

    console.log(`📝 Extracted ${text.length} characters`)

    // Step 2: Analyze text
    const analysis = await analyzeText(text, hasFile)

    console.log(`✅ Analysis done. Score: ${analysis.urgencyScore} (${analysis.severityLevel})`)

    return {
      success:      true,
      originalText: text,
      analysis,
    }

  } catch (error) {
    console.error('Processing error:', error)
    return {
      success:      false,
      originalText: rawText || '',
      analysis: {
        summary:        'Processing failed',
        keywords:       [],
        category:       'Other',
        sentiment:      'neutral',
        sentimentScore: 0,
        urgencyScore:   0,
        severityLevel:  'info',
        affectedPeople: null,
        processingTime: 0,
      },
      error: error.message,
    }
  }
}

module.exports = { processReport }