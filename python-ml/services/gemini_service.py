import os
import logging
from google import genai
from google.genai import types
from typing import Optional
import json

logger = logging.getLogger(__name__)

# ── Enhanced Chat Prompt ───────────────────────────────────────────────
CHAT_PROMPT = """
You are an expert NGO field assistant AI helping a staff member understand a community issue report.

CONTEXT:
You are having a conversation with an NGO field worker who just documented a community issue. 
They need your help to understand the severity and decide whether to submit it to their committee.

REPORT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Title:            {title}
Category:         {category}
Urgency Score:    {urgency_score}/100
Severity:         {severity_level}
Location:         {affected_area}

ANALYSIS SUMMARY:
{summary}

KEY PROBLEMS IDENTIFIED:
{key_problems}

RECOMMENDED ACTIONS:
{suggested_actions}

RISK ASSESSMENT:
- Immediate Risk: {immediate_risk}
- Affected People: {affected_people}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FULL REPORT TEXT:
\"\"\"
{report_text}
\"\"\"

CONVERSATION HISTORY:
{history}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT QUESTION FROM STAFF: "{message}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS FOR YOUR RESPONSE:

1. **ANALYZE THE QUESTION**: 
   - What specifically are they asking about?
   - Are they asking about severity, urgency, actions, or decision to send?
   - Do they need clarification, reassurance, or guidance?

2. **PROVIDE CONTEXT-SPECIFIC ANSWER** (150-300 words):
   - If asking "Should I send?": Give detailed reasoning based on urgency score and severity
   - If asking "How urgent?": Explain timeline, risks, and what could happen if delayed
   - If asking "What happened?": Provide detailed summary with key facts
   - If asking about actions: Explain suggested steps in practical terms
   - If expressing doubt/concern: Be empathetic and provide reassurance with facts
   - If asking about specific aspect: Deep-dive into that particular issue

3. **USE CONVERSATIONAL, EMPATHETIC TONE**:
   - Acknowledge their concern
   - Use simple language (imagine explaining to a non-technical person)
   - Be supportive but honest about severity
   - Reference specific details from THEIR report

4. **PROVIDE CLEAR RECOMMENDATION**:
   Based on urgency score:
   - 80-100: "SEND IMMEDIATELY - This is critical and requires urgent committee attention"
   - 60-79:  "SEND SOON - This should reach the committee within 24 hours"
   - 40-59:  "SEND THIS WEEK - Important but not immediately critical"
   - 20-39:  "YOUR CALL - Low urgency, you can decide timing"
   - 0-19:   "CAN WAIT - Keep as draft unless situation worsens"

5. **VARY YOUR RESPONSE STYLE**:
   - Don't repeat the same phrases
   - Match your tone to their question
   - If they're worried, be more reassuring
   - If they're uncertain, be more directive
   - If they're asking for details, be more analytical

6. **END WITH ACTION GUIDANCE**:
   Based on the question, suggest next steps

CRITICAL: End your response with EXACTLY ONE of these tags on a new line:
[RECOMMEND_SEND]
[RECOMMEND_DRAFT]
[NEUTRAL]

Choose based on:
- [RECOMMEND_SEND]: If urgency ≥ 60 OR immediate risk = true
- [RECOMMEND_DRAFT]: If urgency < 30 AND no immediate risk
- [NEUTRAL]: For informational questions or middle-ground cases (30-59)
"""

# ── System prompt for better context understanding ───────────────────────
SYSTEM_INSTRUCTION = """
You are a compassionate, knowledgeable NGO field assistant AI. Your role is to:
- Help field workers understand the impact of community issues they document
- Provide clear, actionable guidance on whether reports should be escalated
- Explain complex analysis results in simple, human terms
- Be supportive and empathetic while maintaining professional accuracy
- Adapt your communication style to the specific question being asked

Remember: Each question is unique. Think about what the person REALLY needs to know, not just what they asked.
"""


# services/gemini_service.py

class GeminiService:

    def __init__(self):
        try:
            # NEW: Initialize the Gemini client
            self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
            self.model_name = 'gemini-2.0-flash-exp'  # ✅ Updated model name
            logger.info("✅ Gemini initialized for chat (new google.genai)")
        except Exception as e:
            logger.error(f"Gemini init failed: {e}")
            self.client = None

    def _extract_report_fields(self, report_data: dict) -> dict:
        """
        Extract fields from report_data.
        Handles BOTH camelCase (from Node.js) and snake_case.
        """
        analysis = report_data.get("analysis", {})

        def get(camel, snake, default=None):
            return (
                analysis.get(camel) or
                analysis.get(snake) or
                report_data.get(camel) or
                report_data.get(snake) or
                default
            )

        urgency_score = get("urgencyScore",     "urgency_score",     0)
        severity      = get("severityLevel",    "severity_level",    "info")
        category      = get("category",         "category",          "Unknown")
        summary       = get("summary",          "summary",           "No summary available")
        key_problems  = get("keyProblems",      "key_problems",      []) or []
        suggested     = get("suggestedActions", "suggested_actions", []) or []
        immediate     = get("immediateRisk",    "immediate_risk",    False)
        people        = get("affectedPeople",   "affected_people",   "Unknown")
        area          = get("affectedArea",     "affected_area",     "Unknown")
        orig_text     = (
            report_data.get("originalText") or
            report_data.get("original_text") or
            ""
        )

        return {
            "title":             report_data.get("title", "Untitled Report"),
            "urgency_score":     urgency_score,
            "severity_level":    severity,
            "category":          category,
            "summary":           summary,
            "key_problems":      key_problems,
            "suggested_actions": suggested,
            "immediate_risk":    immediate,
            "affected_people":   people,
            "affected_area":     area,
            "original_text":     orig_text,
        }

    def _format_conversation_history(self, history: list) -> str:
        """Format conversation history with better context"""
        if not history:
            return "This is the first message in the conversation."
        
        formatted = []
        for i, msg in enumerate(history[-6:], 1):  # Last 6 messages for context
            role = "Staff Member" if msg.get("role") == "user" else "AI Assistant"
            content = msg.get("content", "").strip()
            formatted.append(f"{i}. {role}: {content}")
        
        return "\n".join(formatted)

    async def chat(
        self,
        message:     str,
        report_data: dict,
        history:     list,
    ) -> dict:
        """
        Chat with Gemini about the report.
        Uses advanced prompting for context-aware responses.
        """
        if not self.client:
            return self._fallback_chat(report_data, message)

        try:
            # Extract fields
            fields = self._extract_report_fields(report_data)

            # Format conversation history with context
            formatted_history = self._format_conversation_history(history)

            # Format lists with better presentation
            key_problems_str = ""
            if fields["key_problems"]:
                problems = fields["key_problems"][:5]
                key_problems_str = "\n".join([f"  • {p}" for p in problems])
            else:
                key_problems_str = "  • No specific problems identified"

            suggested_str = ""
            if fields["suggested_actions"]:
                actions = fields["suggested_actions"][:4]
                suggested_str = "\n".join([f"  → {a}" for a in actions])
            else:
                suggested_str = "  → Requires committee review for action planning"

            # Risk indicator
            risk_emoji = "🔴 YES - Requires immediate attention" if fields["immediate_risk"] else "🟢 NO - Situation is stable"

            prompt = CHAT_PROMPT.format(
                title             = fields["title"],
                category          = fields["category"],
                urgency_score     = fields["urgency_score"],
                severity_level    = fields["severity_level"].upper(),
                summary           = fields["summary"],
                key_problems      = key_problems_str,
                suggested_actions = suggested_str,
                immediate_risk    = risk_emoji,
                affected_people   = fields["affected_people"],
                affected_area     = fields["affected_area"],
                report_text       = str(fields["original_text"])[:3500],
                history           = formatted_history,
                message           = message,
            )

            # Use new API with system instruction
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.8,  # Higher for more varied responses
                    max_output_tokens=800,
                    top_p=0.95,
                    top_k=40,
                    system_instruction=SYSTEM_INSTRUCTION,
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
                recommendation = "neutral"
                ai_message     = ai_message.replace("[NEUTRAL]", "").strip()

            # Dynamic confidence based on multiple factors
            score = float(fields["urgency_score"] or 0)
            has_immediate_risk = fields["immediate_risk"]
            
            if has_immediate_risk:
                confidence = 0.98  # Very high if immediate risk
            elif score >= 80:
                confidence = 0.95
            elif score >= 60:
                confidence = 0.88
            elif score >= 40:
                confidence = 0.72
            elif score >= 20:
                confidence = 0.58
            else:
                confidence = 0.42

            logger.info(
                f"✅ Chat response | question_len={len(message)} | "
                f"rec={recommendation} | conf={confidence:.2f} | score={score}"
            )

            return {
                "message":        ai_message,
                "recommendation": recommendation,
                "confidence":     confidence,
                "success":        True,
            }

        except Exception as e:
            logger.error(f"Gemini chat error: {e}", exc_info=True)
            return self._fallback_chat(report_data, message)

    def _fallback_chat(self, report_data: dict, message: str) -> dict:
        """Enhanced fallback with context-aware responses"""
        fields   = self._extract_report_fields(report_data)
        score    = float(fields["urgency_score"] or 0)
        severity = fields["severity_level"]
        category = fields["category"]
        summary  = fields["summary"]
        
        # Detect question type
        msg_lower = message.lower()
        is_send_question = any(word in msg_lower for word in ['send', 'submit', 'committee', 'should i'])
        is_urgency_question = any(word in msg_lower for word in ['urgent', 'how bad', 'serious', 'critical'])
        is_summary_question = any(word in msg_lower for word in ['what', 'summary', 'happened', 'explain'])

        # Generate contextual response
        if is_send_question:
            if score >= 70:
                msg = (
                    f"Yes, I recommend sending this report to your committee right away. "
                    f"Here's why:\n\n"
                    f"This is a **{severity.upper()}** severity {category} issue with an urgency score of {score}/100. "
                    f"{summary}\n\n"
                    f"The high urgency score indicates this situation needs prompt attention from your committee. "
                    f"Delaying could allow the problem to worsen or affect more people. "
                    f"Your field assessment is valuable, and the committee should see this as soon as possible."
                )
                rec  = "send"
                conf = 0.90
            elif score >= 40:
                msg = (
                    f"I would recommend sending this report to your committee, though it's not extremely urgent. "
                    f"Let me explain:\n\n"
                    f"This is classified as **{severity.upper()}** severity ({category}) with an urgency score of {score}/100. "
                    f"{summary}\n\n"
                    f"While not critical, this issue deserves committee attention within the next 24-48 hours. "
                    f"They can assess resource allocation and plan appropriate interventions. "
                    f"Your documentation helps them make informed decisions."
                )
                rec  = "send"
                conf = 0.75
            else:
                msg = (
                    f"Based on the analysis, this report has lower urgency (score: {score}/100, {severity} severity). "
                    f"You have flexibility in timing:\n\n"
                    f"{summary}\n\n"
                    f"You can keep this as a draft and send it when convenient, or if you notice the situation "
                    f"changing. However, if you feel from your field experience that it needs attention sooner, "
                    f"trust your judgment — you know the community best."
                )
                rec  = "draft"
                conf = 0.55

        elif is_urgency_question:
            if score >= 70:
                msg = (
                    f"This is quite urgent. The urgency score of {score}/100 indicates **{severity.upper()}** severity.\n\n"
                    f"What this means:\n"
                    f"• The issue could worsen if not addressed soon\n"
                    f"• Affected people: {fields['affected_people']}\n"
                    f"• Location: {fields['affected_area']}\n\n"
                    f"{summary}\n\n"
                    f"I recommend getting this to your committee within the next few hours so they can mobilize resources."
                )
                rec = "send"
                conf = 0.92
            else:
                msg = (
                    f"The urgency level is moderate (score: {score}/100, {severity} severity).\n\n"
                    f"This means:\n"
                    f"• The situation is concerning but not immediately critical\n"
                    f"• You have time to document thoroughly before sending\n"
                    f"• Committee can plan response over next few days\n\n"
                    f"{summary}\n\n"
                    f"Keep monitoring the situation and send when you're confident in the documentation."
                )
                rec = "neutral"
                conf = 0.68

        elif is_summary_question:
            problems_text = "\n• ".join(fields["key_problems"][:3]) if fields["key_problems"] else "See full report for details"
            actions_text = "\n→ ".join(fields["suggested_actions"][:3]) if fields["suggested_actions"] else "Requires committee review"
            
            msg = (
                f"Here's what your report documented:\n\n"
                f"**Issue:** {fields['title']}\n"
                f"**Category:** {category}\n"
                f"**Location:** {fields['affected_area']}\n"
                f"**Affected People:** {fields['affected_people']}\n\n"
                f"**Summary:**\n{summary}\n\n"
                f"**Main Problems:**\n• {problems_text}\n\n"
                f"**Suggested Actions:**\n→ {actions_text}\n\n"
                f"**Severity Assessment:** {severity.upper()} (urgency score: {score}/100)\n\n"
                f"{'⚠️ This requires prompt attention.' if score >= 60 else 'This should be reviewed when convenient.'}"
            )
            rec = "send" if score >= 60 else "neutral"
            conf = 0.80

        else:
            # Generic helpful response
            msg = (
                f"I'm here to help you understand this report about {category} issues.\n\n"
                f"**Quick Overview:**\n"
                f"• Severity: {severity.upper()}\n"
                f"• Urgency Score: {score}/100\n"
                f"• Location: {fields['affected_area']}\n\n"
                f"{summary}\n\n"
                f"You can ask me:\n"
                f"• Should I send this to the committee?\n"
                f"• How urgent is this situation?\n"
                f"• What are the main problems?\n"
                f"• What actions are recommended?\n\n"
                f"What would you like to know?"
            )
            rec = "neutral"
            conf = 0.65

        return {
            "message":        msg,
            "recommendation": rec,
            "confidence":     conf,
            "success":        True,
        }


# ✅ Singleton
gemini_service = GeminiService()