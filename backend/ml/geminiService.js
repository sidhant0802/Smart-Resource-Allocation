const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ── Main Gemini Analysis ─────────────────────────────────────
const analyzeWithGemini = async (text, fileType = 'text') => {
  const startTime = Date.now()

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    })

    const prompt = buildPrompt(text, fileType)

    const result   = await model.generateContent(prompt)
    const response = await result.response
    const rawText  = response.text()

    // Parse Gemini response
    const parsed = parseGeminiResponse(rawText)

    return {
      success:       true,
      ...parsed,
      processingTime: Date.now() - startTime,
      model:          'gemini-1.5-flash',
    }

  } catch (error) {
    console.error('Gemini API error:', error)

    // Fallback to rule-based if Gemini fails
    return fallbackAnalysis(text, startTime)
  }
}

// ── Build Gemini Prompt ──────────────────────────────────────
const buildPrompt = (text, fileType) => {
  return `
You are an expert NGO field report analyzer. Analyze the following community issue report and provide a structured assessment.

REPORT CONTENT (from ${fileType}):
"""
${text}
"""

Analyze this report and respond with ONLY a valid JSON object in this exact format:

{
  "urgencyScore": <number 0-100>,
  "severityLevel": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "sentiment": "<very_negative|negative|neutral|positive>",
  "summary": "<2-3 sentence summary of the main issue>",
  "detailedAnalysis": "<detailed paragraph about the situation, its causes, and impacts>",
  "keyProblems": ["<problem 1>", "<problem 2>", "<problem 3>"],
  "suggestedActions": ["<action 1>", "<action 2>", "<action 3>"],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],
  "affectedPeople": <estimated number or null>,
  "affectedArea": "<area/location name or null>",
  "immediateRisk": <true|false>
}

SCORING GUIDE:
- 80-100 (critical): Immediate life threat, epidemic, violence, disaster
- 60-79 (high): Serious health risk, large population affected, urgent needs
- 40-59 (medium): Significant community problem needing attention soon
- 20-39 (low): Minor issue, can be addressed in regular schedule
- 0-19 (info): General information, suggestion, or feedback

Be accurate and realistic. Return ONLY the JSON, no other text.
`
}

// ── Parse Gemini Response ────────────────────────────────────
const parseGeminiResponse = (rawText) => {
  try {
    // Clean response - remove markdown if any
    let cleaned = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Validate and sanitize
    return {
      urgencyScore:     Math.max(0, Math.min(100, Number(parsed.urgencyScore) || 0)),
      severityLevel:    validateEnum(parsed.severityLevel,
        ['critical', 'high', 'medium', 'low', 'info'], 'info'),
      category:         validateEnum(parsed.category,
        ['Health', 'Food', 'Water', 'Education', 'Shelter',
         'Sanitation', 'Disaster', 'Violence', 'Infrastructure', 'Other'],
        'Other'),
      sentiment:        validateEnum(parsed.sentiment,
        ['very_negative', 'negative', 'neutral', 'positive'], 'neutral'),
      summary:          String(parsed.summary || ''),
      detailedAnalysis: String(parsed.detailedAnalysis || ''),
      keyProblems:      Array.isArray(parsed.keyProblems)
        ? parsed.keyProblems.slice(0, 5) : [],
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions.slice(0, 5) : [],
      keywords:         Array.isArray(parsed.keywords)
        ? parsed.keywords.slice(0, 8) : [],
      affectedPeople:   parsed.affectedPeople
        ? Number(parsed.affectedPeople) : null,
      affectedArea:     parsed.affectedArea || null,
      immediateRisk:    Boolean(parsed.immediateRisk),
    }
  } catch (err) {
    console.error('Failed to parse Gemini response:', err)
    console.error('Raw response:', rawText)
    throw new Error('Failed to parse AI response')
  }
}

// ── Validate enum values ─────────────────────────────────────
const validateEnum = (value, validValues, defaultValue) => {
  return validValues.includes(value) ? value : defaultValue
}

// ── Fallback rule-based analysis ─────────────────────────────
const fallbackAnalysis = (text, startTime) => {
  const lower = text.toLowerCase()

  // Simple keyword matching
  const criticalWords = [
    'death', 'died', 'killed', 'flood', 'fire',
    'epidemic', 'cholera', 'violence', 'rape', 'emergency'
  ]
  const highWords = [
    'disease', 'sick', 'hospital', 'injury',
    'contaminated', 'hunger', 'homeless', 'unsafe'
  ]
  const mediumWords = [
    'problem', 'shortage', 'damage', 'broken',
    'dirty', 'garbage', 'blocked', 'sewage'
  ]

  const criticalCount = criticalWords.filter(w => lower.includes(w)).length
  const highCount     = highWords.filter(w => lower.includes(w)).length
  const mediumCount   = mediumWords.filter(w => lower.includes(w)).length

  let urgencyScore  = 10
  let severityLevel = 'info'

  if (criticalCount > 0) {
    urgencyScore  = Math.min(90, 60 + criticalCount * 10)
    severityLevel = 'critical'
  } else if (highCount > 0) {
    urgencyScore  = Math.min(70, 45 + highCount * 5)
    severityLevel = 'high'
  } else if (mediumCount > 0) {
    urgencyScore  = Math.min(50, 30 + mediumCount * 3)
    severityLevel = 'medium'
  } else {
    urgencyScore  = 15
    severityLevel = 'low'
  }

  // Detect category
  let category = 'Other'
  if (lower.includes('water') || lower.includes('sewage') || lower.includes('sanitation'))
    category = 'Sanitation'
  else if (lower.includes('health') || lower.includes('disease') || lower.includes('hospital'))
    category = 'Health'
  else if (lower.includes('food') || lower.includes('hunger'))
    category = 'Food'
  else if (lower.includes('school') || lower.includes('education'))
    category = 'Education'

  const shortText = text.substring(0, 200)

  return {
    success:          true,
    urgencyScore,
    severityLevel,
    category,
    sentiment:        urgencyScore > 50 ? 'very_negative' : 'negative',
    summary:          `Issue detected in report. Category: ${category}. Urgency Score: ${urgencyScore}/100. ${shortText}...`,
    detailedAnalysis: `This report describes a ${category.toLowerCase()} related issue that requires attention. The content suggests ${severityLevel} priority level based on the described conditions.`,
    keyProblems:      ['Issue identified in report', 'Requires investigation'],
    suggestedActions: ['Review report details', 'Assign field team', 'Follow up with community'],
    keywords:         criticalWords.filter(w => lower.includes(w))
      .concat(highWords.filter(w => lower.includes(w)))
      .slice(0, 5),
    affectedPeople:   null,
    affectedArea:     null,
    immediateRisk:    urgencyScore >= 70,
    processingTime:   Date.now() - startTime,
    model:            'fallback-rule-based',
  }
}

// ── Analyze image with Gemini Vision ────────────────────────
const analyzeImageWithGemini = async (imagePath, additionalText = '') => {
  const startTime = Date.now()

  try {
    const fs    = require('fs')
    const path  = require('path')
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    })

    const imageData   = fs.readFileSync(imagePath)
    const base64Image = imageData.toString('base64')
    const mimeType    = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

    const prompt = `
You are an NGO field report analyzer. Analyze this image showing a community issue.
${additionalText ? `Additional context from staff: "${additionalText}"` : ''}

Look at the image carefully and identify:
- What problem/issue is visible
- How serious it appears
- Who might be affected
- What area/location type this appears to be

Respond with ONLY a valid JSON object:
{
  "urgencyScore": <0-100>,
  "severityLevel": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "sentiment": "<very_negative|negative|neutral|positive>",
  "summary": "<what you see in the image and its impact>",
  "detailedAnalysis": "<detailed description of the issue visible in the image>",
  "keyProblems": ["<visible problem 1>", "<visible problem 2>"],
  "suggestedActions": ["<suggested action 1>", "<suggested action 2>"],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "affectedPeople": <estimated number or null>,
  "affectedArea": "<type of area visible>",
  "immediateRisk": <true|false>
}
`

    const result   = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } },
    ])
    const response = await result.response
    const rawText  = response.text()

    const parsed = parseGeminiResponse(rawText)

    return {
      success:        true,
      ...parsed,
      processingTime: Date.now() - startTime,
      model:          'gemini-1.5-flash-vision',
    }

  } catch (error) {
    console.error('Gemini Vision error:', error)
    return fallbackAnalysis(additionalText || 'Image uploaded', startTime)
  }
}

module.exports = {
  analyzeWithGemini,
  analyzeImageWithGemini,
}