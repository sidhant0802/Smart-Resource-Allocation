const {
  detectCategory,
  analyzeSentiment,
  extractKeywords,
  extractAffectedPeople,
  calculateUrgencyScore,
} = require('./scorer')

// ── Generate simple summary ──────────────────────────────────
const generateSummary = (text, category, severityLevel, keywords) => {
  // Take first 200 chars as base
  const shortText = text.substring(0, 300).replace(/\n/g, ' ').trim()

  const severityText = {
    critical: 'CRITICAL ALERT',
    high:     'High Priority Issue',
    medium:   'Medium Priority Issue',
    low:      'Low Priority Notice',
    info:     'General Information',
  }

  const topKeywords = keywords.slice(0, 3).join(', ')

  const summary =
    `[${severityText[severityLevel]}] ` +
    `Category: ${category}. ` +
    (topKeywords ? `Key concerns: ${topKeywords}. ` : '') +
    `${shortText}${text.length > 300 ? '...' : ''}`

  return summary
}

// ── Main analysis function ───────────────────────────────────
const analyzeText = async (text, hasFile = false) => {
  const startTime = Date.now()

  if (!text || text.trim().length === 0) {
    return {
      summary:        'No text content to analyze',
      keywords:       [],
      category:       'Other',
      sentiment:      'neutral',
      sentimentScore: 0,
      urgencyScore:   0,
      severityLevel:  'info',
      affectedPeople: null,
      processingTime: Date.now() - startTime,
    }
  }

  // Run all analyses
  const category       = detectCategory(text)
  const { sentiment, sentimentScore } = analyzeSentiment(text)
  const keywords       = extractKeywords(text)
  const affectedPeople = extractAffectedPeople(text)

  const { urgencyScore, severityLevel } = calculateUrgencyScore({
    text,
    sentiment,
    sentimentScore,
    category,
    hasFile,
    affectedPeople,
  })

  const summary = generateSummary(
    text, category, severityLevel, keywords
  )

  const processingTime = Date.now() - startTime

  return {
    summary,
    keywords,
    category,
    sentiment,
    sentimentScore,
    urgencyScore,
    severityLevel,
    affectedPeople,
    processingTime,
  }
}

module.exports = { analyzeText }