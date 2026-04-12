import logging
from services.gemini_service import gemini_service

logger = logging.getLogger(__name__)


class ChatService:

    async def handle_message(
        self,
        report_id: str,
        message: str,
        report_data: dict,
        history: list,
    ) -> dict:
        """Route chat message to Gemini"""
        logger.info(
            f"💬 Chat | report={report_id} | "
            f"history_len={len(history)} | "
            f"msg_len={len(message)}"
        )

        result = await gemini_service.chat(
            message=message,
            report_data=report_data,
            history=history,
        )

        return {
            "success":        result.get("success", True),
            "message":        result.get("message", "I couldn't generate a response."),
            "recommendation": result.get("recommendation", "neutral"),
            "confidence":     result.get("confidence", 0.7),
            "report_id":      report_id,
        }


chat_service = ChatService()