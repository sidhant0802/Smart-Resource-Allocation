# import os
# import json
# import time
# import logging
# import google.generativeai as genai
# from typing import Optional

# logger = logging.getLogger(__name__)

# # Configure Gemini
# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ANALYSIS_PROMPT = """
# You are an expert NGO field report analyzer specializing in rural India community issues.
# Analyze the following report with deep understanding of local context.

# REPORT CONTENT:
# \"\"\"
# {text}
# \"\"\"

# ML PRE-ANALYSIS:
# - Detected Category: {category}
# - Initial Urgency Score: {ml_score}/100
# - Detected Keywords: {keywords}
# - Affected People Estimate: {affected_people}
# - Immediate Risk: {immediate_risk}

# Based on the report and ML pre-analysis, provide your expert assessment.
# Return ONLY a valid JSON object:

# {{
#   "urgency_score": <refined 0-100 score>,
#   "severity_level": "<critical|high|medium|low|info>",
#   "summary": "<2-3 sentence clear summary of the main issue and its impact>",
#   "detailed_analysis": "<comprehensive 4-6 sentence analysis covering: what the problem is, root causes, who is affected and how, health/safety risks, and urgency of intervention>",
#   "key_problems": [
#     "<specific problem 1 with details>",
#     "<specific problem 2>",
#     "<specific problem 3>"
#   ],
#   "suggested_actions": [
#     "<immediate action needed within 24-48 hours>",
#     "<short-term action within 1 week>",
#     "<long-term solution>"
#   ],
#   "immediate_risk": <true|false>,
#   "confidence_score": <0.0-1.0 how confident you are>,
#   "reasoning": "<1-2 sentences explaining why you gave this score>"
# }}

# SCORING GUIDE:
# 80-100 (critical): Immediate life threat - death, epidemic, serious violence, major disaster
# 60-79 (high): Serious health/safety risk, 100+ people affected, urgent intervention needed
# 40-59 (medium): Significant problem affecting community, needs attention within a week
# 20-39 (low): Minor issue, can be addressed in normal schedule
# 0-19 (info): General information, suggestion, or resolved issue

# Be precise, empathetic, and action-oriented. Return ONLY JSON.
# """

# CHAT_PROMPT = """
# You are an intelligent assistant helping an NGO field staff member decide whether to send a community issue report to their committee.

# REPORT DETAILS:
# Title: {title}
# Category: {category}
# Urgency Score: {urgency_score}/100
# Severity: {severity_level}
# Summary: {summary}
# Key Problems: {key_problems}
# Suggested Actions: {suggested_actions}
# Immediate Risk: {immediate_risk}

# CONVERSATION HISTORY:
# {history}

# STAFF MESSAGE: {message}

# Instructions:
# - Help the staff understand the severity of the report
# - Answer questions about the report's content
# - Advise whether to send to committee or keep as draft
# - Be conversational, empathetic, and clear
# - For critical/high severity: strongly recommend sending immediately
# - For medium: recommend sending with context
# - For low/info: let staff decide, mention it's their choice

# If recommending action, end with one of:
# [RECOMMEND_SEND] - if you think they should send to committee
# [RECOMMEND_DRAFT] - if keeping as draft is fine
# [NEUTRAL] - if no strong recommendation

# Keep response under 150 words. Be helpful and direct.
# """

# class GeminiService:

#     def __init__(self):
#         self.model = genai.GenerativeModel('gemini-1.5-flash')

#     async def analyze_report(
#         self,
#         text:       str,
#         ml_results: dict,
#     ) -> dict:
#         """Deep analysis with Gemini AI"""
#         start = time.time()

#         try:
#             prompt = ANALYSIS_PROMPT.format(
#                 text=text[:4000],
#                 # Limit text to avoid token limits
#                 category=ml_results.get("category", "Other"),
#                 ml_score=ml_results.get("urgency_score", 0),
#                 keywords=", ".join(ml_results.get("keywords", [])[:5]),
#                 affected_people=ml_results.get("affected_people", "unknown"),
#                 immediate_risk=ml_results.get("immediate_risk", False),
#             )

#             response = self.model.generate_content(
#                 prompt,
#                 generation_config=genai.types.GenerationConfig(
#                     temperature=0.2,
#                     # Low temp for consistent analysis
#                     max_output_tokens=1024,
#                 ),
#             )

#             raw = response.text.strip()
#             # Clean markdown if present
#             raw = raw.replace("```json", "").replace("```", "").strip()

#             gemini_result = json.loads(raw)

#             # Blend ML score with Gemini score for accuracy
#             ml_score     = ml_results.get("urgency_score", 0)
#             gemini_score = float(gemini_result.get("urgency_score", ml_score))
#             blended_score = round(
#                 (ml_score * 0.35) + (gemini_score * 0.65),
#                 1
#             )
#             # Gemini gets more weight (65%) as it understands context better

#             # Use blended score to determine severity
#             if blended_score >= 80:   severity = "critical"
#             elif blended_score >= 60: severity = "high"
#             elif blended_score >= 40: severity = "medium"
#             elif blended_score >= 20: severity = "low"
#             else:                     severity = "info"

#             return {
#                 "urgency_score":     blended_score,
#                 "severity_level":    severity,
#                 "summary":           gemini_result.get("summary", ""),
#                 "detailed_analysis": gemini_result.get("detailed_analysis", ""),
#                 "key_problems":      gemini_result.get("key_problems", []),
#                 "suggested_actions": gemini_result.get("suggested_actions", []),
#                 "immediate_risk":    gemini_result.get("immediate_risk", False),
#                 "confidence_score":  float(gemini_result.get("confidence_score", 0.8)),
#                 "reasoning":         gemini_result.get("reasoning", ""),
#                 "processing_time":   round(time.time() - start, 3),
#                 "model_used":        "gemini-1.5-flash + ml-pipeline",
#                 "success":           True,
#             }

#         except json.JSONDecodeError as e:
#             logger.error(f"JSON parse error: {e}")
#             logger.error(f"Raw response: {raw}")
#             return self._fallback(ml_results, start)

#         except Exception as e:
#             logger.error(f"Gemini error: {e}")
#             return self._fallback(ml_results, start)

#     def _fallback(self, ml_results: dict, start: float) -> dict:
#         """Use ML results if Gemini fails"""
#         score    = ml_results.get("urgency_score", 0)
#         severity = ml_results.get("severity_level", "info")

#         return {
#             "urgency_score":     score,
#             "severity_level":    severity,
#             "summary":           f"Report analyzed. Category: {ml_results.get('category')}. Score: {score}/100.",
#             "detailed_analysis": ml_results.get("explanation", ""),
#             "key_problems":      [],
#             "suggested_actions": ["Review report manually", "Assess urgency"],
#             "immediate_risk":    ml_results.get("immediate_risk", False),
#             "confidence_score":  0.5,
#             "reasoning":         "Analysis done using ML pipeline (AI unavailable)",
#             "processing_time":   round(time.time() - start, 3),
#             "model_used":        "ml-pipeline-fallback",
#             "success":           True,
#         }

#     async def chat(
#         self,
#         message:     str,
#         report_data: dict,
#         history:     list,
#     ) -> dict:
#         """Chat with AI about the report"""
#         try:
#             # Format history
#             formatted_history = ""
#             for msg in history[-6:]:
#                 # Last 6 messages for context
#                 role    = "Staff" if msg.get("role") == "user" else "AI"
#                 content = msg.get("content", "")
#                 formatted_history += f"{role}: {content}\n"

#             analysis = report_data.get("analysis", {})

#             prompt = CHAT_PROMPT.format(
#                 title=report_data.get("title", "Unknown"),
#                 category=analysis.get("category", "Unknown"),
#                 urgency_score=analysis.get("urgencyScore", 0),
#                 severity_level=analysis.get("severityLevel", "info"),
#                 summary=analysis.get("summary", "No summary"),
#                 key_problems="; ".join(
#                     analysis.get("keyProblems", [])[:3]
#                 ),
#                 suggested_actions="; ".join(
#                     analysis.get("suggestedActions", [])[:2]
#                 ),
#                 immediate_risk=analysis.get("immediateRisk", False),
#                 history=formatted_history or "No previous messages",
#                 message=message,
#             )

#             response = self.model.generate_content(
#                 prompt,
#                 generation_config=genai.types.GenerationConfig(
#                     temperature=0.7,
#                     max_output_tokens=256,
#                 ),
#             )

#             ai_message = response.text.strip()

#             # Extract recommendation
#             recommendation = "neutral"
#             if "[RECOMMEND_SEND]" in ai_message:
#                 recommendation = "send"
#                 ai_message     = ai_message.replace("[RECOMMEND_SEND]", "").strip()
#             elif "[RECOMMEND_DRAFT]" in ai_message:
#                 recommendation = "draft"
#                 ai_message     = ai_message.replace("[RECOMMEND_DRAFT]", "").strip()
#             elif "[NEUTRAL]" in ai_message:
#                 ai_message = ai_message.replace("[NEUTRAL]", "").strip()

#             # Auto-set confidence based on severity
#             severity   = analysis.get("severityLevel", "info")
#             confidence = {
#                 "critical": 0.95,
#                 "high":     0.85,
#                 "medium":   0.70,
#                 "low":      0.55,
#                 "info":     0.40,
#             }.get(severity, 0.60)

#             return {
#                 "message":        ai_message,
#                 "recommendation": recommendation,
#                 "confidence":     confidence,
#                 "success":        True,
#             }

#         except Exception as e:
#             logger.error(f"Chat error: {e}")
#             return {
#                 "message":        "I'm having trouble analyzing this right now. Please review the urgency score and decide based on your field experience.",
#                 "recommendation": "neutral",
#                 "confidence":     0.5,
#                 "success":        False,
#             }

# # Singleton
# gemini_service = GeminiService()
























import os
import logging
import google.generativeai as genai
from typing import Optional

logger = logging.getLogger(__name__)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ── Chat Prompt ───────────────────────────────────────────────
CHAT_PROMPT = """
You are an expert NGO field assistant helping a staff member understand a community issue report and decide whether to submit it to their committee.

REPORT DETAILS:
Title:         {title}
Category:      {category}
Urgency Score: {urgency_score}/100
Severity:      {severity_level}
Summary:       {summary}
Key Problems:  {key_problems}
Suggested Actions: {suggested_actions}
Immediate Risk: {immediate_risk}
Affected People: {affected_people}
Affected Area:  {affected_area}

FULL REPORT TEXT:
\"\"\"
{report_text}
\"\"\"

CONVERSATION SO FAR:
{history}

STAFF QUESTION: {message}

Your job:
1. Give a DETAILED, helpful response (150-250 words)
2. Reference specific details from the report
3. Explain the severity clearly in simple language
4. Give a clear recommendation on whether to submit or keep as draft
5. If asked for summary — give a LONG, detailed summary covering: what happened, who is affected, where, health/safety risks, and what action is needed
6. Be empathetic, clear, and action-oriented
7. Use simple English that field staff can understand

Scoring guide for your recommendation:
- 80-100: ALWAYS recommend sending immediately
- 60-79:  Strongly recommend sending within 24 hours
- 40-59:  Recommend sending this week
- 20-39:  Staff can decide, low urgency
- 0-19:   Keep as draft unless staff wants to share

End your response with exactly ONE of these tags on a new line:
[RECOMMEND_SEND]
[RECOMMEND_DRAFT]
[NEUTRAL]
"""

class GeminiService:

    def __init__(self):
        try:
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            logger.info("✅ Gemini initialized for chat")
        except Exception as e:
            logger.error(f"Gemini init failed: {e}")
            self.model = None

    async def chat(
        self,
        message:     str,
        report_data: dict,
        history:     list,
    ) -> dict:
        """
        Chat with Gemini about the report.
        Gemini is ONLY used here — not for analysis.
        """
        if not self.model:
            return self._fallback_chat(report_data)

        try:
            # Format conversation history
            formatted_history = ""
            for msg in history[-8:]:
                role    = "Staff" if msg.get("role") == "user" else "Assistant"
                content = msg.get("content", "")
                formatted_history += f"{role}: {content}\n"

            if not formatted_history:
                formatted_history = "No previous messages"

            # Build prompt with full report context
            prompt = CHAT_PROMPT.format(
                title=report_data.get("title", "Untitled Report"),
                category=report_data.get("severity_level", report_data.get("category", "Unknown")),
                urgency_score=report_data.get("urgency_score", 0),
                severity_level=report_data.get("severity_level", "info"),
                summary=report_data.get("summary", "No summary available"),
                key_problems="\n- ".join(report_data.get("key_problems", []) or ["Not specified"]),
                suggested_actions="\n- ".join(report_data.get("suggested_actions", []) or ["Review manually"]),
                immediate_risk=report_data.get("immediate_risk", False),
                affected_people=report_data.get("affected_people", "Unknown"),
                affected_area=report_data.get("affected_area", "Unknown"),
                report_text=report_data.get("original_text", "")[:3000],
                history=formatted_history,
                message=message,
            )

            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.6,
                    max_output_tokens=512,
                ),
            )

            ai_message = response.text.strip()

            # Extract recommendation tag
            recommendation = "neutral"
            if "[RECOMMEND_SEND]" in ai_message:
                recommendation = "send"
                ai_message     = ai_message.replace("[RECOMMEND_SEND]", "").strip()
            elif "[RECOMMEND_DRAFT]" in ai_message:
                recommendation = "draft"
                ai_message     = ai_message.replace("[RECOMMEND_DRAFT]", "").strip()
            elif "[NEUTRAL]" in ai_message:
                ai_message = ai_message.replace("[NEUTRAL]", "").strip()

            # Confidence based on urgency score
            score = report_data.get("urgency_score", 0)
            if score >= 80:   confidence = 0.95
            elif score >= 60: confidence = 0.85
            elif score >= 40: confidence = 0.70
            elif score >= 20: confidence = 0.55
            else:             confidence = 0.40

            return {
                "message":        ai_message,
                "recommendation": recommendation,
                "confidence":     confidence,
                "success":        True,
            }

        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            return self._fallback_chat(report_data)

    def _fallback_chat(self, report_data: dict) -> dict:
        """Fallback when Gemini is unavailable"""
        score    = report_data.get("urgency_score", 0)
        severity = report_data.get("severity_level", "info")
        category = report_data.get("category", "Unknown")

        if score >= 70:
            msg  = (
                f"This is a {severity.upper()} severity {category} report "
                f"with urgency score {score}/100. "
                f"Based on the analysis, I strongly recommend sending this to "
                f"the committee immediately. The situation requires urgent attention."
            )
            rec  = "send"
            conf = 0.90
        elif score >= 40:
            msg  = (
                f"This report has a {severity} severity level (score: {score}/100). "
                f"It is a {category} issue that should be reviewed by the committee. "
                f"I recommend submitting it for review within the next 24-48 hours."
            )
            rec  = "send"
            conf = 0.70
        else:
            msg  = (
                f"This report has a low urgency score of {score}/100. "
                f"You can keep it as a draft for now and submit when ready. "
                f"Use your field judgment to decide the right time."
            )
            rec  = "draft"
            conf = 0.50

        return {
            "message":        msg,
            "recommendation": rec,
            "confidence":     conf,
            "success":        True,
        }


# Singleton
gemini_service = GeminiService()