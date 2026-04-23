import logging
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class ChatService:
    """Routes chat messages to Gemini with fallback handling"""

    async def handle_message(
        self,
        report_id: str,
        message: str,
        report_data: dict,
        history: list,
    ) -> dict:
        """Handle chat message with comprehensive error handling"""

        logger.info(
            f"💬 Chat | report={report_id} | "
            f"history={len(history)} | "
            f"msg='{message[:80]}'"
        )

        if not message or not message.strip():
            return {
                "success": True,
                "message": "Please ask me a question about your report.",
                "recommendation": "neutral",
                "confidence": 0.5,
                "report_id": report_id,
            }

        try:
            result = await gemini_service.chat(
                message=message.strip(),
                report_data=report_data,
                history=history,
            )

            return {
                "success": result.get("success", True),
                "message": result.get("message", "I couldn't generate a response. Please try again."),
                "recommendation": result.get("recommendation", "neutral"),
                "confidence": result.get("confidence", 0.7),
                "report_id": report_id,
            }

        except Exception as e:
            logger.error(f"❌ Chat error: {e}", exc_info=True)

            # Emergency fallback
            urgency = report_data.get("analysis", {}).get("urgencyScore") or \
                      report_data.get("urgency_score") or 0

            if float(urgency) >= 60:
                msg = (
                    f"I encountered an error, but based on the urgency score of {urgency}/100, "
                    f"I recommend SENDING this report to the committee TODAY. "
                    f"High urgency situations should not wait."
                )
                rec = "send"
            else:
                msg = (
                    f"I encountered an error processing your question. "
                    f"Please try again. Your report has urgency score {urgency}/100."
                )
                rec = "neutral"

            return {
                "success": False,
                "message": msg,
                "recommendation": rec,
                "confidence": 0.5,
                "report_id": report_id,
            }


chat_service = ChatService()