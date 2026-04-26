import os
import time
import logging
import base64
from typing import Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════
# MAIN ANALYSIS PROMPT
# ══════════════════════════════════════════════════════════════
ANALYSIS_PROMPT = """
You are an expert NGO field report analyst AI with deep knowledge of humanitarian issues in India.
Analyze the following report content and provide a COMPREHENSIVE, ACCURATE, and ACTIONABLE analysis.

REPORT CONTENT:
\"\"\"
{text}
\"\"\"

FILE TYPE: {file_type}
ADDITIONAL CONTEXT: {extra_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURN ONLY VALID JSON — NO MARKDOWN, NO TEXT OUTSIDE JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{{
  "urgency_score": <integer 0-100>,
  "severity_level": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "summary": "<2-3 sentence clear, specific summary of the main issue — what happened, where, who is affected>",
  "detailed_analysis": "<4-6 sentences covering: what happened, who is affected, scale of impact, underlying causes, immediate risks, and urgency justification>",
  "key_problems": [
    "<specific problem 1 — concrete and specific>",
    "<specific problem 2>",
    "<specific problem 3>",
    "<specific problem 4>",
    "<specific problem 5>"
  ],
  "suggested_actions": [
    "<IMMEDIATE action within 24hrs — specific>",
    "<SHORT-TERM action within 1 week>",
    "<MEDIUM-TERM action within 1 month>",
    "<LONG-TERM systemic action>"
  ],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>", "<keyword6>"],
  "affected_people": <integer or null — be conservative if unclear>,
  "affected_area": "<specific location name if mentioned, else null>",
  "immediate_risk": <true if life is at risk or situation is deteriorating, else false>,
  "sentiment": "<very_negative|negative|neutral|positive>",
  "confidence_score": <float 0.0-1.0 — how confident you are in this analysis>,
  "root_causes": [
    "<root cause 1 — why is this happening>",
    "<root cause 2>"
  ],
  "risk_factors": [
    "<risk that could make situation worse>",
    "<risk factor 2>",
    "<risk factor 3>"
  ],
  "resources_needed": [
    "<specific resource 1 — medicines, food, water, etc.>",
    "<resource 2>",
    "<resource 3>"
  ],
  "timeline": "<immediate — within hours|within 24 hours|within 1 week|within 1 month|long-term>",
  "stakeholders": [
    "<who needs to be involved — specific dept or person>",
    "<stakeholder 2>"
  ],
  "similar_issues": "<are there patterns suggesting a systemic or recurring problem? If yes, describe briefly>",
  "field_notes": "<any specific observations, quotes, or details from the report text worth highlighting>"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING GUIDELINES — BE ACCURATE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URGENCY SCORE (0-100):
• 90-100: Active emergency — deaths reported, epidemic confirmed, building collapsed, mass violence
• 75-89:  Critical situation — serious injuries, disease spreading, major displacement, violence
• 60-74:  High urgency — significant impact on many families, health emergency, infrastructure failure
• 45-59:  Moderate — multiple families affected, chronic illness, important but not emergency
• 30-44:  Low-moderate — community issue, limited resources, moderate impact
• 15-29:  Low — minor issue, single family affected, limited impact
• 0-14:   Informational — no immediate concern, routine report

SEVERITY MAPPING:
• critical: Score 80-100 — life-threatening, act NOW
• high:     Score 60-79 — serious, respond today
• medium:   Score 40-59 — important, respond this week
• low:      Score 20-39 — routine, monitor
• info:     Score 0-19 — informational only

IMPORTANT RULES:
1. Do NOT exaggerate — be accurate based on evidence in text
2. If text is vague/short, give lower confidence and lower score
3. Extract ALL location names, numbers, and names mentioned
4. If report is in Hindi/mixed language, understand it fully
5. Consider vulnerability: children, women, elderly increase urgency
6. Look for repeated/chronic issues — they need systemic solutions
"""

# ══════════════════════════════════════════════════════════════
# IMAGE ANALYSIS PROMPT
# ══════════════════════════════════════════════════════════════
IMAGE_ANALYSIS_PROMPT = """
You are an expert NGO field report analyst. Analyze this image submitted as a field report.

CONTEXT FROM FIELD STAFF: {extra_context}

Carefully examine the image and extract ALL visible information:
- What is happening in this image?
- Who is visible? (estimate numbers if possible)
- What conditions are shown? (damage, distress, infrastructure, health, etc.)
- What location clues are visible?
- What is the urgency level based on what you see?

Return ONLY valid JSON (no markdown):

{{
  "urgency_score": <integer 0-100>,
  "severity_level": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "summary": "<2-3 sentences describing what you see and why it matters>",
  "detailed_analysis": "<4-6 sentences — detailed visual analysis, what conditions exist, who is affected, what risks are visible>",
  "visual_observations": "<detailed description of everything visible — people, environment, infrastructure, conditions, expressions, damage>",
  "key_problems": [
    "<visible problem 1>",
    "<visible problem 2>",
    "<visible problem 3>",
    "<visible problem 4>"
  ],
  "suggested_actions": [
    "<immediate action based on what you see>",
    "<short term action>",
    "<medium term action>"
  ],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],
  "affected_people": <estimated count if visible else null>,
  "affected_area": "<location if any signboards/landmarks visible else null>",
  "immediate_risk": <true if visible danger, else false>,
  "sentiment": "<very_negative|negative|neutral|positive>",
  "confidence_score": <float 0.0-1.0>,
  "root_causes": ["<possible root cause 1>", "<possible root cause 2>"],
  "risk_factors": ["<visible risk 1>", "<visible risk 2>"],
  "resources_needed": ["<resource needed 1>", "<resource needed 2>"],
  "timeline": "<immediate|within 24 hours|within 1 week|within 1 month>",
  "stakeholders": ["<who should see this>"],
  "field_notes": "<any text visible in image, license plates, signboards, dates, or other specific details>"
}}
"""

# ══════════════════════════════════════════════════════════════
# CHAT SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════
CHAT_SYSTEM = """
You are a compassionate, expert NGO field assistant AI. You help NGO field workers understand 
community issues they document, assess urgency, and decide on next steps.

Your role:
- Help field workers understand what their report means
- Give specific, actionable guidance
- Be honest about severity — don't sugarcoat serious situations
- Encourage field worker judgment — they know the ground reality
- Be empathetic — these are real people in real situations
- Give practical advice they can act on immediately

Communication style:
- Clear and direct (avoid jargon)
- Empathetic and supportive
- Specific (reference their actual report)
- Action-oriented
- Appropriately urgent when needed
"""

CHAT_PROMPT = """
You are helping an NGO field worker understand their submitted report and decide next steps.

═══════════════════════════════════════════════════
REPORT DETAILS:
═══════════════════════════════════════════════════
Title: {title}
Category: {category}
Urgency Score: {urgency_score}/100
Severity Level: {severity_level}
Affected Area: {affected_area}
Affected People: {affected_people}
Immediate Risk: {immediate_risk}

AI ANALYSIS SUMMARY:
{summary}

DETAILED ANALYSIS:
{detailed_analysis}

KEY PROBLEMS IDENTIFIED:
{key_problems}

RECOMMENDED ACTIONS:
{suggested_actions}

ROOT CAUSES:
{root_causes}

RISK FACTORS:
{risk_factors}

RESOURCES NEEDED:
{resources_needed}

ORIGINAL REPORT TEXT:
\"\"\"
{report_text}
\"\"\"

═══════════════════════════════════════════════════
CONVERSATION HISTORY:
{history}

═══════════════════════════════════════════════════
FIELD WORKER'S QUESTION: "{message}"
═══════════════════════════════════════════════════

HOW TO RESPOND:

1. UNDERSTAND what they really need — urgency guidance? explanation? next steps?

2. GIVE A SPECIFIC ANSWER (150-300 words):
   - Reference actual details FROM THEIR REPORT (not generic advice)
   - Use simple, clear language
   - Be honest about severity
   - Provide concrete, actionable steps

3. URGENCY GUIDANCE based on score {urgency_score}/100:
   - 80-100: "SEND IMMEDIATELY — This is critical, the committee must see this NOW"
   - 60-79:  "SEND TODAY — Urgent situation, don't delay beyond today"
   - 40-59:  "SEND THIS WEEK — Important issue, committee review needed soon"
   - 20-39:  "YOUR JUDGMENT — You know the situation, share when ready"
   - 0-19:   "LOW URGENCY — Keep as draft until you have more information"

4. BE SPECIFIC about WHY based on actual report content

5. End with exactly ONE tag:
   [RECOMMEND_SEND]  — urgency >= 60 OR immediate_risk = true
   [RECOMMEND_DRAFT] — urgency < 30 AND no immediate risk
   [NEUTRAL]         — informational questions OR urgency 30-59

Remember: This field worker trusts your guidance. Be clear, specific, and helpful.
"""


class GeminiService:

    def __init__(self):
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not set in environment")

            self.client = genai.Client(api_key=api_key)
            self.model = 'gemini-2.0-flash'
            self.available = True
            logger.info(f"✅ Gemini initialized: {self.model}")
        except Exception as e:
            logger.error(f"❌ Gemini init failed: {e}")
            self.client = None
            self.available = False

    # ══════════════════════════════════════════════════════════
    # ANALYZE TEXT
    # ══════════════════════════════════════════════════════════
    async def analyze_text(
        self,
        text: str,
        file_type: str = "text",
        extra_context: str = "",
    ) -> Optional[dict]:
        """Use Gemini to analyze text content"""

        if not self.available or not self.client:
            logger.warning("⚠️ Gemini not available")
            return None

        if not text or len(text.strip()) < 10:
            logger.warning("⚠️ Text too short for analysis")
            return None

        try:
            prompt = ANALYSIS_PROMPT.format(
                text=text[:10000],
                file_type=file_type,
                extra_context=extra_context or "No additional context provided",
            )

            logger.info(f"🤖 Gemini analyzing {len(text)} chars ({file_type})")
            start = time.time()

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.15,
                    max_output_tokens=2500,
                    top_p=0.85,
                    top_k=40,
                ),
            )

            raw = response.text.strip()
            elapsed = time.time() - start
            logger.info(f"✅ Gemini responded in {elapsed:.2f}s ({len(raw)} chars)")

            result = self._parse_json_response(raw)
            if result:
                result["model_used"] = f"gemini-{self.model}"
                result["extracted_text"] = text[:3000]
                self._validate_and_fix(result)
                return result

            logger.error("❌ Failed to parse Gemini JSON response")
            return None

        except Exception as e:
            logger.error(f"❌ Gemini text analysis error: {e}", exc_info=True)
            return None

    # ══════════════════════════════════════════════════════════
    # ANALYZE IMAGE
    # ══════════════════════════════════════════════════════════
    async def analyze_image(
        self,
        image_path: str,
        extra_context: str = "",
    ) -> Optional[dict]:
        """Use Gemini Vision to analyze an image"""

        if not self.available or not self.client:
            return None

        try:
            with open(image_path, "rb") as f:
                image_data = f.read()

            ext = os.path.splitext(image_path)[1].lower()
            mime_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".bmp": "image/bmp",
            }
            mime_type = mime_map.get(ext, "image/jpeg")

            prompt = IMAGE_ANALYSIS_PROMPT.format(
                extra_context=extra_context or "No additional context provided"
            )

            logger.info(f"🖼️ Gemini Vision analyzing: {image_path} ({mime_type})")
            start = time.time()

            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    types.Part.from_bytes(
                        data=image_data,
                        mime_type=mime_type,
                    ),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    temperature=0.15,
                    max_output_tokens=2500,
                ),
            )

            raw = response.text.strip()
            logger.info(f"✅ Gemini Vision responded in {time.time()-start:.2f}s")

            result = self._parse_json_response(raw)
            if result:
                result["model_used"] = f"gemini-vision-{self.model}"
                self._validate_and_fix(result)
                return result

        except Exception as e:
            logger.error(f"❌ Gemini image analysis error: {e}", exc_info=True)

        return None

    # ══════════════════════════════════════════════════════════
    # ANALYZE PDF
    # ══════════════════════════════════════════════════════════
    async def analyze_pdf(
        self,
        pdf_path: str,
        extra_context: str = "",
    ) -> Optional[dict]:
        """Extract text from PDF and analyze with Gemini"""

        try:
            import fitz  # PyMuPDF

            logger.info(f"📄 Extracting PDF: {pdf_path}")
            doc = fitz.open(pdf_path)
            text_parts = []
            page_count = len(doc)

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                page_text = page.get_text("text")
                if page_text.strip():
                    text_parts.append(f"[Page {page_num + 1}]\n{page_text}")
                logger.info(f"  Page {page_num + 1}/{page_count}: {len(page_text)} chars")

            doc.close()
            full_text = "\n\n".join(text_parts).strip()
            logger.info(f"📄 PDF total: {len(full_text)} chars, {page_count} pages")

            if len(full_text.strip()) < 20:
                logger.warning("⚠️ PDF has very little text (possibly scanned)")
                full_text = (
                    f"PDF document uploaded with {page_count} pages but minimal extractable text. "
                    f"Staff context: {extra_context}"
                )

            result = await self.analyze_text(
                text=full_text,
                file_type="pdf",
                extra_context=extra_context,
            )

            if result:
                result["pdf_pages"] = page_count
                result["pdf_chars"] = len(full_text)
                result["extracted_text"] = full_text[:5000]

            return result

        except ImportError:
            logger.error("❌ PyMuPDF (fitz) not installed")
            return await self.analyze_text(
                text=f"PDF file uploaded. Staff context: {extra_context}",
                file_type="pdf",
                extra_context=extra_context,
            )
        except Exception as e:
            logger.error(f"❌ PDF analysis error: {e}", exc_info=True)
            return None

    # ══════════════════════════════════════════════════════════
    # CHAT
    # ══════════════════════════════════════════════════════════
    async def chat(
        self,
        message: str,
        report_data: dict,
        history: list,
    ) -> dict:
        """Context-aware chat about a specific report"""

        if not self.available or not self.client:
            return self._fallback_chat(report_data, message)

        try:
            fields = self._extract_report_fields(report_data)
            history_str = self._format_history(history)

            def fmt_list(items, bullet="•", max_items=5):
                if not items:
                    return "  None identified"
                return "\n".join(
                    f"  {bullet} {str(item).strip()}"
                    for item in items[:max_items]
                    if item
                )

            prompt = CHAT_PROMPT.format(
                title=fields["title"],
                category=fields["category"],
                urgency_score=fields["urgency_score"],
                severity_level=str(fields["severity_level"]).upper(),
                affected_area=fields["affected_area"] or "Not specified",
                affected_people=f"~{fields['affected_people']}" if fields["affected_people"] else "Not specified",
                immediate_risk="⚠️ YES — IMMEDIATE RISK" if fields["immediate_risk"] else "✅ No immediate risk",
                summary=fields["summary"] or "No summary available",
                detailed_analysis=fields.get("detailed_analysis", "See summary above"),
                key_problems=fmt_list(fields["key_problems"]),
                suggested_actions=fmt_list(fields["suggested_actions"], "→"),
                root_causes=fmt_list(fields.get("root_causes", []), "◆"),
                risk_factors=fmt_list(fields.get("risk_factors", []), "⚡"),
                resources_needed=fmt_list(fields.get("resources_needed", []), "📦"),
                report_text=str(fields["original_text"])[:4000],
                history=history_str,
                message=message,
            )

            start = time.time()
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.6,
                    max_output_tokens=700,
                    top_p=0.95,
                    system_instruction=CHAT_SYSTEM,
                ),
            )

            ai_text = response.text.strip()
            logger.info(f"✅ Chat response in {time.time()-start:.2f}s")

            # Extract recommendation tag
            recommendation = "neutral"
            if "[RECOMMEND_SEND]" in ai_text:
                recommendation = "send"
                ai_text = ai_text.replace("[RECOMMEND_SEND]", "").strip()
            elif "[RECOMMEND_DRAFT]" in ai_text:
                recommendation = "draft"
                ai_text = ai_text.replace("[RECOMMEND_DRAFT]", "").strip()
            elif "[NEUTRAL]" in ai_text:
                recommendation = "neutral"
                ai_text = ai_text.replace("[NEUTRAL]", "").strip()

            # Confidence score
            score = float(fields.get("urgency_score") or 0)
            confidence = (
                0.98 if fields["immediate_risk"] else
                0.93 if score >= 80 else
                0.87 if score >= 60 else
                0.75 if score >= 40 else
                0.60 if score >= 20 else
                0.45
            )

            return {
                "message": ai_text,
                "recommendation": recommendation,
                "confidence": confidence,
                "success": True,
            }

        except Exception as e:
            logger.error(f"❌ Chat error: {e}", exc_info=True)
            return self._fallback_chat(report_data, message)

    # ══════════════════════════════════════════════════════════
    # VALIDATE AND FIX ANALYSIS RESULT
    # ══════════════════════════════════════════════════════════
    def _validate_and_fix(self, result: dict) -> None:
        """Validate and fix common issues in Gemini response"""

        # Fix urgency_score
        try:
            score = int(result.get("urgency_score", 0))
            result["urgency_score"] = max(0, min(100, score))
        except (ValueError, TypeError):
            result["urgency_score"] = 0

        # Fix severity_level
        valid_severities = ["critical", "high", "medium", "low", "info"]
        if result.get("severity_level") not in valid_severities:
            score = result.get("urgency_score", 0)
            if score >= 80:
                result["severity_level"] = "critical"
            elif score >= 60:
                result["severity_level"] = "high"
            elif score >= 40:
                result["severity_level"] = "medium"
            elif score >= 20:
                result["severity_level"] = "low"
            else:
                result["severity_level"] = "info"

        # Fix category
        valid_categories = [
            "Health", "Food", "Water", "Education", "Shelter",
            "Sanitation", "Disaster", "Violence", "Infrastructure", "Other"
        ]
        if result.get("category") not in valid_categories:
            result["category"] = "Other"

        # Fix sentiment
        valid_sentiments = ["very_negative", "negative", "neutral", "positive"]
        if result.get("sentiment") not in valid_sentiments:
            result["sentiment"] = "negative"

        # Ensure lists are lists
        for field in ["key_problems", "suggested_actions", "keywords",
                      "root_causes", "risk_factors", "resources_needed",
                      "stakeholders"]:
            if not isinstance(result.get(field), list):
                result[field] = []

        # Fix confidence_score
        try:
            conf = float(result.get("confidence_score", 0.7))
            result["confidence_score"] = max(0.0, min(1.0, conf))
        except (ValueError, TypeError):
            result["confidence_score"] = 0.7

        # Fix immediate_risk
        result["immediate_risk"] = bool(result.get("immediate_risk", False))

        # Fix affected_people
        try:
            if result.get("affected_people") is not None:
                result["affected_people"] = int(result["affected_people"])
        except (ValueError, TypeError):
            result["affected_people"] = None

        # Ensure strings
        for field in ["summary", "detailed_analysis", "field_notes",
                      "timeline", "similar_issues", "affected_area",
                      "visual_observations"]:
            if result.get(field) and not isinstance(result[field], str):
                result[field] = str(result[field])

    # ══════════════════════════════════════════════════════════
    # PARSE JSON RESPONSE
    # ══════════════════════════════════════════════════════════
    def _parse_json_response(self, raw: str) -> Optional[dict]:
        """Parse Gemini JSON response with multiple fallback strategies"""
        import json
        import re

        if not raw:
            return None

        # Strategy 1: Direct parse
        try:
            return json.loads(raw)
        except Exception:
            pass

        # Strategy 2: Strip markdown blocks
        cleaned = raw
        for marker in ["```json", "```JSON", "```"]:
            if marker in cleaned:
                parts = cleaned.split(marker)
                if len(parts) >= 3:
                    cleaned = parts[1].strip()
                    break
                elif len(parts) == 2:
                    cleaned = parts[1].split("```")[0].strip()
                    break

        try:
            return json.loads(cleaned)
        except Exception:
            pass

        # Strategy 3: Find JSON object
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass

        # Strategy 4: Greedy JSON extraction
        start_idx = raw.find('{')
        end_idx = raw.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            try:
                return json.loads(raw[start_idx:end_idx + 1])
            except Exception:
                pass

        # Strategy 5: Fix common JSON issues
        try:
            fixed = raw
            fixed = re.sub(r',\s*}', '}', fixed)
            fixed = re.sub(r',\s*]', ']', fixed)
            fixed = re.sub(r':\s*undefined', ': null', fixed)
            fixed = re.sub(r':\s*NaN', ': 0', fixed)
            start_idx = fixed.find('{')
            end_idx = fixed.rfind('}')
            if start_idx != -1 and end_idx != -1:
                return json.loads(fixed[start_idx:end_idx + 1])
        except Exception:
            pass

        logger.error(f"❌ Could not parse JSON. First 300 chars: {raw[:300]}")
        return None

    # ══════════════════════════════════════════════════════════
    # HELPERS
    # ══════════════════════════════════════════════════════════
    def _extract_report_fields(self, report_data: dict) -> dict:
        """Extract fields handling both camelCase and snake_case"""
        analysis = report_data.get("analysis", {})

        def get(camel, snake, default=None):
            return (
                analysis.get(camel) or analysis.get(snake) or
                report_data.get(camel) or report_data.get(snake) or
                default
            )

        return {
            "title":             report_data.get("title") or "Untitled Report",
            "urgency_score":     get("urgencyScore", "urgency_score", 0),
            "severity_level":    get("severityLevel", "severity_level", "info"),
            "category":          get("category", "category", "Other"),
            "summary":           get("summary", "summary", "No summary available"),
            "detailed_analysis": get("detailedAnalysis", "detailed_analysis", ""),
            "key_problems":      get("keyProblems", "key_problems", []) or [],
            "suggested_actions": get("suggestedActions", "suggested_actions", []) or [],
            "root_causes":       get("rootCauses", "root_causes", []) or [],
            "risk_factors":      get("riskFactors", "risk_factors", []) or [],
            "resources_needed":  get("resourcesNeeded", "resources_needed", []) or [],
            "immediate_risk":    get("immediateRisk", "immediate_risk", False),
            "affected_people":   get("affectedPeople", "affected_people", None),
            "affected_area":     get("affectedArea", "affected_area", None),
            "original_text": (
                report_data.get("originalText") or
                report_data.get("original_text") or
                report_data.get("manualDescription") or
                ""
            ),
        }

    def _format_history(self, history: list) -> str:
        """Format conversation history"""
        if not history:
            return "No previous messages in this conversation."
        lines = []
        for msg in history[-8:]:
            role = "Field Worker" if msg.get("role") == "user" else "AI Assistant"
            content = str(msg.get("content", "")).strip()
            if content:
                lines.append(f"{role}: {content}")
        return "\n".join(lines) if lines else "No previous messages."

    # ══════════════════════════════════════════════════════════
    # FALLBACK CHAT (when Gemini unavailable)
    # ══════════════════════════════════════════════════════════
    def _fallback_chat(self, report_data: dict, message: str) -> dict:
        """Intelligent fallback when Gemini unavailable"""
        fields = self._extract_report_fields(report_data)
        score = float(fields.get("urgency_score") or 0)
        severity = fields.get("severity_level", "info")
        category = fields.get("category", "Other")
        msg_lower = message.lower()

        # Determine intent
        is_send_question = any(
            w in msg_lower
            for w in ["send", "submit", "should i", "committee", "report", "share"]
        )
        is_urgency_question = any(
            w in msg_lower
            for w in ["urgent", "serious", "important", "priority", "critical"]
        )
        is_action_question = any(
            w in msg_lower
            for w in ["do", "action", "next", "step", "what should", "how"]
        )

        if is_send_question or is_urgency_question:
            if score >= 75 or fields["immediate_risk"]:
                text = (
                    f"**Send this report IMMEDIATELY.** 🚨\n\n"
                    f"Your report has a {severity.upper()} severity score of {score}/100. "
                    f"{fields['summary']}\n\n"
                    f"The committee needs this NOW — don't wait. "
                    f"{'There is an IMMEDIATE RISK to life or safety. ' if fields['immediate_risk'] else ''}"
                    f"Click 'Send to Committee' right away."
                )
                rec, conf = "send", 0.95
            elif score >= 55:
                text = (
                    f"**Send this report today.** 🔴\n\n"
                    f"Urgency score: {score}/100 ({severity} severity). "
                    f"{fields['summary']}\n\n"
                    f"This {category.lower()} issue needs committee attention today. "
                    f"Don't delay more than a few hours."
                )
                rec, conf = "send", 0.85
            elif score >= 35:
                text = (
                    f"**Recommend sending this week.** 🟡\n\n"
                    f"Score: {score}/100 ({severity} severity). "
                    f"{fields['summary']}\n\n"
                    f"This is worth committee review. "
                    f"You can send today or in the next day or two."
                )
                rec, conf = "send", 0.72
            else:
                text = (
                    f"**Your judgment call.** 🟢\n\n"
                    f"Score: {score}/100 ({severity} severity). "
                    f"This is a lower urgency {category.lower()} issue. "
                    f"You can keep it as draft and add more details, "
                    f"or send when you feel ready."
                )
                rec, conf = "draft", 0.60

        elif is_action_question:
            actions = fields.get("suggested_actions", [])
            if actions:
                action_text = "\n".join(f"• {a}" for a in actions[:4])
                text = (
                    f"**Recommended actions for this {category} issue:**\n\n"
                    f"{action_text}\n\n"
                    f"Priority: {'Take action IMMEDIATELY' if score >= 70 else 'Take action this week'}."
                )
            else:
                text = (
                    f"For this {severity} severity {category} issue, "
                    f"focus on documenting the situation thoroughly, "
                    f"{'alert emergency services immediately' if score >= 70 else 'coordinate with local authorities'}, "
                    f"and keep the committee informed."
                )
            rec, conf = ("send" if score >= 60 else "neutral"), 0.75

        else:
            # General info response
            summary = fields.get("summary") or "See the analysis above."
            text = (
                f"**Report Analysis Summary:**\n\n"
                f"• **Category:** {category}\n"
                f"• **Severity:** {severity.upper()} ({score}/100)\n"
                f"• **Affected:** {fields.get('affected_people') or 'Unknown'} people\n"
                f"• **Location:** {fields.get('affected_area') or 'Not specified'}\n\n"
                f"**Summary:** {summary}\n\n"
                f"Feel free to ask: 'Should I send this?' or 'What actions should I take?'"
            )
            rec, conf = "neutral", 0.65

        return {
            "message": text,
            "recommendation": rec,
            "confidence": conf,
            "success": True
        }


# Singleton
gemini_service = GeminiService()
