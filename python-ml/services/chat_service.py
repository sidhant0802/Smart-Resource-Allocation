import logging
from typing import Optional
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class ChatService:
    """
    Handles AI chat conversations about analyzed reports.
    Wraps gemini_service.chat() with business logic.
    """

    async def handle_message(
        self,
        report_id:   str,
        message:     str,
        report_data: dict,
        history:     list,
    ) -> dict:
        """
        Process a user chat message about a specific report.

        Args:
            report_id:   MongoDB report _id (for logging)
            message:     User's message text
            report_data: Full report + analysis dict from MongoDB
            history:     Previous chat messages [{role, content}, ...]

        Returns:
            {
                message:        str,   # AI reply
                recommendation: str,   # 'send' | 'draft' | 'escalate' | None
                confidence:     float, # 0.0 - 1.0
                report_id:      str,
            }
        """
        logger.info(f"ChatService: report={report_id} msg='{message[:60]}...'")

        try:
            # Build enriched context from report data
            analysis     = report_data.get('analysis', {})
            severity     = analysis.get('severityLevel', 'unknown')
            urgency      = analysis.get('urgencyScore', 0)
            summary      = analysis.get('summary', 'No summary available')
            category     = analysis.get('category', 'Unknown')
            visibility   = report_data.get('visibility', 'draft')
            immediate    = analysis.get('immediateRisk', False)

            # Inject report context into message for Gemini
            enriched_context = {
                "report_id":      report_id,
                "title":          report_data.get('title', ''),
                "severity_level": severity,
                "urgency_score":  urgency,
                "category":       category,
                "summary":        summary,
                "immediate_risk": immediate,
                "current_status": visibility,
                "key_problems":   analysis.get('keyProblems', []),
                "suggested_actions": analysis.get('suggestedActions', []),
            }

            # Call Gemini
            result = await gemini_service.chat(
                message=message,
                report_data=enriched_context,
                history=history,
            )

            # Determine recommendation based on severity + AI response
            recommendation = self._determine_recommendation(
                ai_response=result.get('message', ''),
                severity=severity,
                urgency=urgency,
                immediate_risk=immediate,
            )

            return {
                "message":        result.get('message', 'I could not process your request.'),
                "recommendation": recommendation,
                "confidence":     result.get('confidence', 0.8),
                "report_id":      report_id,
            }

        except Exception as e:
            logger.error(f"ChatService error: {e}", exc_info=True)
            return {
                "message":        "Sorry, I am temporarily unavailable. Please try again.",
                "recommendation": None,
                "confidence":     0.0,
                "report_id":      report_id,
            }

    def _determine_recommendation(
        self,
        ai_response:   str,
        severity:      str,
        urgency:       int,
        immediate_risk: bool,
    ) -> Optional[str]:
        """
        Auto-determine send/draft/escalate recommendation
        based on severity + AI response keywords.
        """
        response_lower = ai_response.lower()

        # Always escalate if immediate risk
        if immediate_risk or severity == 'critical':
            return 'send'

        # High urgency → recommend sending
        if urgency >= 70 or severity == 'high':
            return 'send'

        # Check AI response for keywords
        send_keywords  = ['send', 'submit', 'forward', 'urgent', 'immediately', 'report it']
        draft_keywords = ['draft', 'wait', 'hold', 'review', 'more info', 'not enough']

        send_score  = sum(1 for kw in send_keywords  if kw in response_lower)
        draft_score = sum(1 for kw in draft_keywords if kw in response_lower)

        if send_score > draft_score:
            return 'send'
        elif draft_score > send_score:
            return 'draft'

        # Medium severity default
        if severity == 'medium':
            return 'send'

        return 'draft'


# ✅ Singleton instance
chat_service = ChatService()