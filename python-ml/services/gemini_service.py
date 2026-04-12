import os
import time
import logging
import base64
from typing import Optional
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════
# GEMINI ANALYSIS PROMPT - For PDF/Image/Text Analysis
# ══════════════════════════════════════════════════════════════
ANALYSIS_PROMPT = """
You are an expert NGO field report analyst AI. Analyze the following report content and provide a comprehensive, structured analysis.

REPORT CONTENT:
\"\"\"
{text}
\"\"\"

FILE TYPE: {file_type}
ADDITIONAL CONTEXT: {extra_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVIDE A COMPLETE ANALYSIS IN THE FOLLOWING JSON FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON, no markdown, no explanation outside JSON:

{{
  "urgency_score": <integer 0-100>,
  "severity_level": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "summary": "<2-3 sentence clear summary of the main issue>",
  "detailed_analysis": "<comprehensive 4-6 sentence analysis covering what happened, who is affected, why it matters, and what risks exist>",
  "key_problems": [
    "<specific problem 1>",
    "<specific problem 2>",
    "<specific problem 3>",
    "<specific problem 4>",
    "<specific problem 5>"
  ],
  "suggested_actions": [
    "<immediate action 1>",
    "<short-term action 2>",
    "<medium-term action 3>",
    "<long-term action 4>"
  ],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],
  "affected_people": <integer or null>,
  "affected_area": "<location name or null>",
  "immediate_risk": <true|false>,
  "sentiment": "<very_negative|negative|neutral|positive>",
  "confidence_score": <float 0.0-1.0>,
  "root_causes": ["<root cause 1>", "<root cause 2>"],
  "risk_factors": ["<risk factor 1>", "<risk factor 2>", "<risk factor 3>"],
  "resources_needed": ["<resource 1>", "<resource 2>", "<resource 3>"],
  "timeline": "<immediate|within 24 hours|within 1 week|within 1 month>",
  "stakeholders": ["<who needs to be involved>"],
  "similar_issues": "<are there patterns suggesting systemic problems>",
  "field_notes": "<any important observations from the report text>"
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING GUIDELINES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

URGENCY SCORE (0-100):
• 90-100: Mass casualty, epidemic, building collapse, immediate life threat
• 75-89:  Deaths reported, critical illness, major disaster, violence
• 60-74:  Serious injury, disease outbreak, significant displacement
• 45-59:  Multiple families affected, chronic illness, infrastructure failure  
• 30-44:  Community issue, limited resources, moderate impact
• 15-29:  Minor issue, single family, limited impact
• 0-14:   Informational, no immediate concern

SEVERITY LEVELS:
• critical: Score 80-100, life-threatening, immediate action needed
• high:     Score 60-79, serious impact, urgent response required
• medium:   Score 40-59, significant concern, timely response needed
• low:      Score 20-39, minor issue, routine response
• info:     Score 0-19, informational only

Be accurate, specific, and thorough. Extract ALL relevant information from the text.
"""

# ══════════════════════════════════════════════════════════════
# GEMINI IMAGE ANALYSIS PROMPT
# ══════════════════════════════════════════════════════════════
IMAGE_ANALYSIS_PROMPT = """
You are an expert NGO field report analyst. Analyze this image from a field report.

ADDITIONAL CONTEXT FROM STAFF: {extra_context}

Look carefully at the image and provide:
1. What you see - describe the situation in detail
2. Any visible problems, damage, or concerning conditions
3. Estimated number of people affected if visible
4. Location clues from the image
5. Urgency indicators

Then provide analysis in this JSON format (return ONLY JSON):

{{
  "urgency_score": <integer 0-100>,
  "severity_level": "<critical|high|medium|low|info>",
  "category": "<Health|Food|Water|Education|Shelter|Sanitation|Disaster|Violence|Infrastructure|Other>",
  "summary": "<what you see and why it matters - 2-3 sentences>",
  "detailed_analysis": "<comprehensive visual analysis - what, who, conditions, risks - 4-6 sentences>",
  "key_problems": ["<visible problem 1>", "<visible problem 2>", "<visible problem 3>"],
  "suggested_actions": ["<action 1>", "<action 2>", "<action 3>", "<action 4>"],
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],
  "affected_people": <estimated count or null>,
  "affected_area": "<location if identifiable or null>",
  "immediate_risk": <true|false>,
  "sentiment": "<very_negative|negative|neutral|positive>",
  "confidence_score": <float 0.0-1.0>,
  "visual_observations": "<detailed description of what is visible in the image>",
  "root_causes": ["<possible root cause 1>", "<possible root cause 2>"],
  "risk_factors": ["<risk 1>", "<risk 2>"],
  "resources_needed": ["<resource 1>", "<resource 2>"],
  "timeline": "<immediate|within 24 hours|within 1 week|within 1 month>",
  "stakeholders": ["<stakeholder 1>", "<stakeholder 2>"],
  "field_notes": "<additional observations>"
}}
"""

# ══════════════════════════════════════════════════════════════
# CHAT PROMPT
# ══════════════════════════════════════════════════════════════
CHAT_SYSTEM = """
You are a compassionate, expert NGO field assistant AI. You help field workers understand 
community issues they document, provide guidance on report urgency, and support decision-making.

Your strengths:
- Clear, empathetic communication
- Practical, actionable advice  
- Deep understanding of NGO field work
- Ability to explain complex situations simply
- Supporting field workers in difficult situations

Always be:
- Honest about severity
- Encouraging of field worker judgment
- Specific with your recommendations
- Aware that these are real people in real situations
"""

CHAT_PROMPT = """
You are helping an NGO field worker understand their report and decide next steps.

REPORT CONTEXT:
━━━━━━━━━━━━━━
Title: {title}
Category: {category}  
Urgency Score: {urgency_score}/100
Severity: {severity_level}
Location: {affected_area}
Affected People: {affected_people}
Immediate Risk: {immediate_risk}

AI ANALYSIS SUMMARY:
{summary}

DETAILED ANALYSIS:
{detailed_analysis}

KEY PROBLEMS FOUND:
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

CONVERSATION SO FAR:
{history}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD WORKER'S QUESTION: "{message}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE INSTRUCTIONS:

1. Read the question carefully - what does this person REALLY need to know?

2. Give a SPECIFIC, HELPFUL answer (150-300 words) that:
   - Directly addresses their question
   - References specific details from THEIR report
   - Uses simple, clear language
   - Is empathetic to their field situation
   - Provides actionable guidance

3. DECISION GUIDANCE based on urgency score {urgency_score}/100:
   - 80-100: "SEND NOW - Critical, committee needs this immediately"
   - 60-79:  "SEND TODAY - Urgent, don't delay more than a few hours" 
   - 40-59:  "SEND THIS WEEK - Important but not emergency"
   - 20-39:  "YOUR CALL - You know the situation best"
   - 0-19:   "CAN WAIT - Low urgency, draft is fine for now"

4. Be specific about WHY based on the actual report content

5. End with EXACTLY ONE recommendation tag:
[RECOMMEND_SEND]   - if urgency >= 60 OR immediate risk = true
[RECOMMEND_DRAFT]  - if urgency < 30 AND no immediate risk
[NEUTRAL]          - for informational questions or 30-59 range

Remember: This field worker is in the community, they trust your guidance. Be clear and helpful.
"""


class GeminiService:

    def __init__(self):
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not set")

            self.client = genai.Client(api_key=api_key)
            self.model = 'gemini-2.0-flash-exp'
            self.available = True
            logger.info(f"✅ Gemini initialized: {self.model}")
        except Exception as e:
            logger.error(f"❌ Gemini init failed: {e}")
            self.client = None
            self.available = False

    # ══════════════════════════════════════════════════════════
    # ANALYZE TEXT (PDF text / voice text / direct text)
    # ══════════════════════════════════════════════════════════
    async def analyze_text(
        self,
        text: str,
        file_type: str = "text",
        extra_context: str = "",
    ) -> dict:
        """Use Gemini to analyze extracted text from any source"""

        if not self.available or not self.client:
            logger.warning("Gemini not available, using ML fallback")
            return None

        if not text or len(text.strip()) < 10:
            return None

        try:
            prompt = ANALYSIS_PROMPT.format(
                text=text[:8000],
                file_type=file_type,
                extra_context=extra_context or "None provided",
            )

            logger.info(f"🤖 Gemini analyzing {len(text)} chars of {file_type}")
            start = time.time()

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=2000,
                    top_p=0.9,
                ),
            )

            raw = response.text.strip()
            logger.info(f"✅ Gemini responded in {time.time()-start:.2f}s")

            # Parse JSON response
            result = self._parse_json_response(raw)
            if result:
                result["model_used"] = f"gemini-{self.model}"
                return result

        except Exception as e:
            logger.error(f"❌ Gemini text analysis error: {e}", exc_info=True)

        return None

    # ══════════════════════════════════════════════════════════
    # ANALYZE IMAGE (direct vision)
    # ══════════════════════════════════════════════════════════
    async def analyze_image(
        self,
        image_path: str,
        extra_context: str = "",
    ) -> dict:
        """Use Gemini Vision to analyze an image directly"""

        if not self.available or not self.client:
            return None

        try:
            # Read image and encode to base64
            with open(image_path, "rb") as f:
                image_data = f.read()

            # Detect mime type
            ext = os.path.splitext(image_path)[1].lower()
            mime_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".webp": "image/webp",
            }
            mime_type = mime_map.get(ext, "image/jpeg")

            prompt = IMAGE_ANALYSIS_PROMPT.format(
                extra_context=extra_context or "No additional context provided"
            )

            logger.info(f"🖼️ Gemini Vision analyzing image: {image_path}")
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
                    temperature=0.2,
                    max_output_tokens=2000,
                ),
            )

            raw = response.text.strip()
            logger.info(f"✅ Gemini Vision responded in {time.time()-start:.2f}s")

            result = self._parse_json_response(raw)
            if result:
                result["model_used"] = f"gemini-vision-{self.model}"
                return result

        except Exception as e:
            logger.error(f"❌ Gemini image analysis error: {e}", exc_info=True)

        return None

    # ══════════════════════════════════════════════════════════
    # ANALYZE PDF (extract text then analyze)
    # ══════════════════════════════════════════════════════════
    async def analyze_pdf(
        self,
        pdf_path: str,
        extra_context: str = "",
    ) -> dict:
        """Extract text from PDF and analyze with Gemini"""

        try:
            import fitz  # PyMuPDF

            logger.info(f"📄 Extracting PDF text: {pdf_path}")
            doc = fitz.open(pdf_path)
            text = ""
            page_count = len(doc)

            for page_num in range(page_count):
                page = doc.load_page(page_num)
                page_text = page.get_text("text")
                text += page_text
                logger.info(f"  Page {page_num+1}/{page_count}: {len(page_text)} chars")

            doc.close()
            text = text.strip()
            logger.info(f"📄 PDF extracted: {len(text)} total chars, {page_count} pages")

            if len(text) < 20:
                logger.warning("PDF has very little text, may be scanned")
                # Try to get at least something
                return await self.analyze_text(
                    text="PDF document was uploaded but contains minimal extractable text. "
                         f"Context: {extra_context}",
                    file_type="pdf",
                    extra_context=extra_context,
                )

            # Analyze the extracted text with Gemini
            result = await self.analyze_text(
                text=text,
                file_type="pdf",
                extra_context=extra_context,
            )

            if result:
                result["pdf_pages"] = page_count
                result["pdf_chars"] = len(text)
                result["extracted_text"] = text[:3000]

            return result

        except Exception as e:
            logger.error(f"❌ PDF analysis error: {e}", exc_info=True)
            return None

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
        except:
            pass

        # Strategy 2: Strip markdown code blocks
        cleaned = raw
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(cleaned)
        except:
            pass

        # Strategy 3: Find JSON object with regex
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass

        # Strategy 4: Fix common JSON issues
        try:
            fixed = raw
            fixed = re.sub(r',\s*}', '}', fixed)
            fixed = re.sub(r',\s*]', ']', fixed)
            match = re.search(r'\{.*\}', fixed, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass

        logger.error(f"❌ Could not parse JSON from Gemini response: {raw[:200]}")
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

            # Format lists
            def fmt_list(items, bullet="•"):
                if not items:
                    return "  None identified"
                return "\n".join(f"  {bullet} {item}" for item in items[:5])

            prompt = CHAT_PROMPT.format(
                title=fields["title"],
                category=fields["category"],
                urgency_score=fields["urgency_score"],
                severity_level=fields["severity_level"].upper(),
                affected_area=fields["affected_area"] or "Unknown",
                affected_people=fields["affected_people"] or "Unknown",
                immediate_risk="⚠️ YES" if fields["immediate_risk"] else "✅ No",
                summary=fields["summary"],
                detailed_analysis=fields.get("detailed_analysis", "See summary"),
                key_problems=fmt_list(fields["key_problems"]),
                suggested_actions=fmt_list(fields["suggested_actions"], "→"),
                root_causes=fmt_list(fields.get("root_causes", []), "◆"),
                risk_factors=fmt_list(fields.get("risk_factors", []), "⚡"),
                resources_needed=fmt_list(fields.get("resources_needed", []), "📦"),
                report_text=str(fields["original_text"])[:3000],
                history=history_str,
                message=message,
            )

            start = time.time()
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    max_output_tokens=800,
                    top_p=0.95,
                    system_instruction=CHAT_SYSTEM,
                ),
            )

            ai_text = response.text.strip()
            logger.info(f"✅ Chat response in {time.time()-start:.2f}s")

            # Extract recommendation
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

            # Confidence based on score
            score = float(fields["urgency_score"] or 0)
            confidence = (
                0.98 if fields["immediate_risk"] else
                0.93 if score >= 80 else
                0.85 if score >= 60 else
                0.72 if score >= 40 else
                0.58 if score >= 20 else 0.42
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
    # HELPERS
    # ══════════════════════════════════════════════════════════
    def _extract_report_fields(self, report_data: dict) -> dict:
        analysis = report_data.get("analysis", {})

        def get(camel, snake, default=None):
            return (
                analysis.get(camel) or analysis.get(snake) or
                report_data.get(camel) or report_data.get(snake) or
                default
            )

        return {
            "title":             report_data.get("title", "Untitled"),
            "urgency_score":     get("urgencyScore",     "urgency_score",     0),
            "severity_level":    get("severityLevel",    "severity_level",    "info"),
            "category":          get("category",         "category",          "Other"),
            "summary":           get("summary",          "summary",           "No summary"),
            "detailed_analysis": get("detailedAnalysis", "detailed_analysis", ""),
            "key_problems":      get("keyProblems",      "key_problems",      []) or [],
            "suggested_actions": get("suggestedActions", "suggested_actions", []) or [],
            "root_causes":       get("rootCauses",       "root_causes",       []) or [],
            "risk_factors":      get("riskFactors",      "risk_factors",      []) or [],
            "resources_needed":  get("resourcesNeeded",  "resources_needed",  []) or [],
            "immediate_risk":    get("immediateRisk",    "immediate_risk",    False),
            "affected_people":   get("affectedPeople",   "affected_people",   None),
            "affected_area":     get("affectedArea",     "affected_area",     None),
            "original_text":     (
                report_data.get("originalText") or
                report_data.get("original_text") or ""
            ),
        }

    def _format_history(self, history: list) -> str:
        if not history:
            return "No previous messages."
        lines = []
        for msg in history[-6:]:
            role = "Field Worker" if msg.get("role") == "user" else "AI"
            lines.append(f"{role}: {msg.get('content', '').strip()}")
        return "\n".join(lines)

    # ══════════════════════════════════════════════════════════
    # FALLBACK CHAT (when Gemini unavailable)
    # ══════════════════════════════════════════════════════════
    def _fallback_chat(self, report_data: dict, message: str) -> dict:
        fields = self._extract_report_fields(report_data)
        score = float(fields["urgency_score"] or 0)
        msg_lower = message.lower()

        if any(w in msg_lower for w in ["send", "submit", "should i", "committee"]):
            if score >= 70:
                text = (
                    f"Yes, send this report immediately. "
                    f"The urgency score of {score}/100 ({fields['severity_level']} severity) "
                    f"indicates this needs urgent committee attention.\n\n"
                    f"{fields['summary']}\n\n"
                    f"Don't delay — the committee needs this information now."
                )
                rec, conf = "send", 0.92
            elif score >= 40:
                text = (
                    f"I recommend sending this report today. "
                    f"Score: {score}/100 ({fields['severity_level']}) — worth the committee's attention.\n\n"
                    f"{fields['summary']}"
                )
                rec, conf = "send", 0.78
            else:
                text = (
                    f"This report has lower urgency ({score}/100). "
                    f"You can keep it as draft or send when convenient. "
                    f"Trust your field judgment — you know the situation best."
                )
                rec, conf = "draft", 0.60
        else:
            text = (
                f"**Report Analysis:**\n"
                f"• Severity: {fields['severity_level'].upper()} ({score}/100)\n"
                f"• Category: {fields['category']}\n\n"
                f"{fields['summary']}\n\n"
                f"Ask me: Should I send this? How urgent is it? What should be done?"
            )
            rec, conf = "neutral", 0.65

        return {"message": text, "recommendation": rec, "confidence": conf, "success": True}


# Singleton
gemini_service = GeminiService()