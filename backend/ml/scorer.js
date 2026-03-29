// ── Keyword lists by severity ────────────────────────────────
const KEYWORDS = {
  critical: [
    'death', 'dead', 'died', 'killed', 'murder', 'rape',
    'fire', 'flood', 'earthquake', 'epidemic', 'outbreak',
    'cholera', 'malaria', 'dengue', 'covid', 'pandemic',
    'violence', 'attack', 'bomb', 'explosion', 'riot',
    'emergency', 'critical', 'disaster', 'collapse',
    'मृत्यु', 'बाढ़', 'आग', 'महामारी',
  ],
  high: [
    'injury', 'injured', 'hurt', 'sick', 'disease', 'hospital',
    'homeless', 'hunger', 'starvation', 'abuse', 'unsafe',
    'contaminated', 'polluted', 'broken', 'collapsed',
    'accident', 'missing', 'lost', 'theft', 'robbery',
    'बीमार', 'भूख', 'बेघर', 'दुर्घटना',
  ],
  medium: [
    'problem', 'issue', 'shortage', 'lack', 'need', 'required',
    'damaged', 'poor', 'bad', 'dirty', 'smell', 'garbage',
    'blocked', 'closed', 'delay', 'complaint', 'request',
    'समस्या', 'कमी', 'जरूरत',
  ],
  low: [
    'suggestion', 'improvement', 'feedback', 'query',
    'information', 'update', 'follow', 'general',
    'सुझाव', 'जानकारी',
  ],
}

// ── Category keywords ────────────────────────────────────────
const CATEGORIES = {
  Health: [
    'health', 'hospital', 'doctor', 'medicine', 'disease',
    'sick', 'patient', 'medical', 'clinic', 'vaccine',
    'epidemic', 'fever', 'malaria', 'dengue', 'cholera',
  ],
  Food: [
    'food', 'hunger', 'starvation', 'meal', 'eating',
    'ration', 'nutrition', 'malnutrition', 'grain', 'water',
  ],
  Water: [
    'water', 'drinking', 'supply', 'pipe', 'contaminated',
    'dirty water', 'flood', 'sewage', 'sanitation', 'toilet',
  ],
  Education: [
    'school', 'education', 'student', 'teacher', 'class',
    'learning', 'book', 'study', 'literacy', 'college',
  ],
  Shelter: [
    'house', 'shelter', 'home', 'homeless', 'roof',
    'building', 'construction', 'repair', 'collapsed',
  ],
  Violence: [
    'violence', 'attack', 'abuse', 'rape', 'assault',
    'fight', 'murder', 'threat', 'harassment', 'domestic',
  ],
  Disaster: [
    'flood', 'fire', 'earthquake', 'cyclone', 'storm',
    'landslide', 'drought', 'disaster', 'emergency',
  ],
  Infrastructure: [
    'road', 'bridge', 'electricity', 'power', 'light',
    'broken', 'damaged', 'repair', 'blocked', 'construction',
  ],
  Sanitation: [
    'garbage', 'waste', 'sanitation', 'toilet', 'sewage',
    'drain', 'clean', 'hygiene', 'dirty', 'smell',
  ],
}

// ── Category weights ─────────────────────────────────────────
const CATEGORY_WEIGHTS = {
  Health:         20,
  Violence:       20,
  Disaster:       20,
  Food:           16,
  Water:          16,
  Shelter:        14,
  Education:      10,
  Sanitation:     10,
  Infrastructure: 8,
  Other:          5,
}

// ── Detect category from text ────────────────────────────────
const detectCategory = (text) => {
  const lowerText = text.toLowerCase()
  const scores    = {}

  for (const [cat, words] of Object.entries(CATEGORIES)) {
    scores[cat] = words.filter(w => lowerText.includes(w)).length
  }

  const topCategory = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0]

  return topCategory[1] > 0 ? topCategory[0] : 'Other'
}

// ── Simple sentiment analysis ────────────────────────────────
const analyzeSentiment = (text) => {
  const lowerText = text.toLowerCase()
  let score = 0

  const negative = [
    'bad', 'terrible', 'horrible', 'awful', 'worst',
    'dangerous', 'urgent', 'critical', 'serious', 'severe',
    'died', 'dead', 'hurt', 'pain', 'suffer', 'emergency',
  ]
  const positive = [
    'good', 'better', 'improved', 'resolved', 'fixed',
    'helped', 'support', 'safe', 'well', 'fine',
  ]

  negative.forEach(w => {
    if (lowerText.includes(w)) score -= 1
  })
  positive.forEach(w => {
    if (lowerText.includes(w)) score += 1
  })

  const normalized = Math.max(-1, Math.min(1, score / 10))

  let sentiment
  if (normalized < -0.3)      sentiment = 'very_negative'
  else if (normalized < -0.1) sentiment = 'negative'
  else if (normalized < 0.1)  sentiment = 'neutral'
  else                        sentiment = 'positive'

  return { sentiment, sentimentScore: normalized }
}

// ── Extract keywords ─────────────────────────────────────────
const extractKeywords = (text) => {
  const lowerText = text.toLowerCase()
  const found     = []

  const allKeywords = [
    ...KEYWORDS.critical,
    ...KEYWORDS.high,
    ...KEYWORDS.medium,
  ]

  allKeywords.forEach(kw => {
    if (lowerText.includes(kw) && !found.includes(kw)) {
      found.push(kw)
    }
  })

  return found.slice(0, 10)
}

// ── Extract affected people count ────────────────────────────
const extractAffectedPeople = (text) => {
  const patterns = [
    /(\d+)\s*(?:people|persons|families|households|villagers|residents)/gi,
    /affecting\s*(\d+)/gi,
    /(\d+)\s*(?:affected|impacted|displaced)/gi,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) return parseInt(match[1])
  }
  return null
}

// ── Calculate urgency score ──────────────────────────────────
const calculateUrgencyScore = ({
  text,
  sentiment,
  sentimentScore,
  category,
  hasFile,
  affectedPeople,
}) => {
  let score = 0
  const lowerText = text.toLowerCase()

  // 1. Keyword score (40 points max)
  const criticalCount = KEYWORDS.critical.filter(
    w => lowerText.includes(w)
  ).length
  const highCount = KEYWORDS.high.filter(
    w => lowerText.includes(w)
  ).length
  const mediumCount = KEYWORDS.medium.filter(
    w => lowerText.includes(w)
  ).length

  if (criticalCount > 0) score += Math.min(40, criticalCount * 15)
  else if (highCount > 0) score += Math.min(30, highCount * 10)
  else if (mediumCount > 0) score += Math.min(20, mediumCount * 5)
  else score += 5

  // 2. Sentiment score (20 points max)
  if (sentiment === 'very_negative')  score += 20
  else if (sentiment === 'negative')  score += 14
  else if (sentiment === 'neutral')   score += 5
  else score += 2

  // 3. Category weight (20 points max)
  score += CATEGORY_WEIGHTS[category] || 5

  // 4. File proof (10 points)
  score += hasFile ? 10 : 3

  // 5. Affected people (10 points)
  if (affectedPeople) {
    if (affectedPeople > 500)      score += 10
    else if (affectedPeople > 100) score += 7
    else if (affectedPeople > 50)  score += 5
    else score += 3
  } else {
    score += 3
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score))

  // Determine severity level
  let severityLevel
  if (score >= 80)      severityLevel = 'critical'
  else if (score >= 60) severityLevel = 'high'
  else if (score >= 40) severityLevel = 'medium'
  else if (score >= 20) severityLevel = 'low'
  else                  severityLevel = 'info'

  return { urgencyScore: score, severityLevel }
}

module.exports = {
  detectCategory,
  analyzeSentiment,
  extractKeywords,
  extractAffectedPeople,
  calculateUrgencyScore,
}