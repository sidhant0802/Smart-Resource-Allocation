import os
import pathlib
import time
import logging
import tempfile
from typing import Optional

import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env from same folder
load_dotenv(pathlib.Path(__file__).parent / ".env")
print(f"🔑 GEMINI_API_KEY: {'✅ Found' if os.getenv('GEMINI_API_KEY') else '❌ Missing'}")

from models.schemas import ChatRequest
from services.extractor import TextExtractor
from services.analyzer import MLAnalyzer
from services.gemini_service import gemini_service
from services.chat_service import chat_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NGO ML Analysis Service",
    version="5.0.0",
    description="Gemini AI + ML Analysis for NGO Field Reports"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "NGO ML Analysis Service",
        "version": "5.0.0",
        "status": "running",
        "gemini": gemini_service.available,
    }


@app.get("/health")
async def health():
    return {
        "status": "OK",
        "service": "NGO ML + Gemini Service",
        "version": "5.0.0",
        "gemini_ready": gemini_service.available,
        "model": gemini_service.model if gemini_service.available else "unavailable",
        "timestamp": time.time(),
    }


@app.post("/analyze")
async def analyze_report(
    file: Optional[UploadFile] = File(None),
    file_type: str = Form("text"),
    raw_text: Optional[str] = Form(""),
    report_id: str = Form(...),
    extra_context: Optional[str] = Form(""),
):
    start_time = time.time()
    temp_path = None

    logger.info(
        f"📊 Analyzing | report={report_id} | "
        f"type={file_type} | has_file={file is not None} | "
        f"text_len={len(raw_text or '')}"
    )

    try:
        # ── Save uploaded file ───────────────────────────────
        if file and file.filename:
            suffix = os.path.splitext(file.filename)[1] or ".bin"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            content = await file.read()
            tmp.write(content)
            tmp.close()
            temp_path = tmp.name
            logger.info(f"📁 Saved temp file: {temp_path} ({len(content)} bytes)")

        gemini_result = None

        # ── Gemini Analysis ──────────────────────────────────
        if gemini_service.available:

            if file_type == "pdf" and temp_path:
                logger.info("📄 PDF → Gemini analysis")
                gemini_result = await gemini_service.analyze_pdf(
                    pdf_path=temp_path,
                    extra_context=extra_context or raw_text or "",
                )

            elif file_type == "image" and temp_path:
                logger.info("🖼️ Image → Gemini Vision")
                gemini_result = await gemini_service.analyze_image(
                    image_path=temp_path,
                    extra_context=extra_context or raw_text or "",
                )

            elif file_type in ("voice", "text") and (raw_text or extra_context):
                text = (raw_text or extra_context or "").strip()
                if text:
                    logger.info(f"✏️ {file_type} → Gemini text ({len(text)} chars)")
                    gemini_result = await gemini_service.analyze_text(
                        text=text,
                        file_type=file_type,
                        extra_context=extra_context or "",
                    )

            elif temp_path:
                # Unknown type with file — extract then analyze
                extraction = await TextExtractor.extract(
                    file_type=file_type,
                    file_path=temp_path,
                    raw_text=raw_text or "",
                )
                text = extraction.get("text", "")
                if text and len(text) > 10:
                    gemini_result = await gemini_service.analyze_text(
                        text=text,
                        file_type=file_type,
                        extra_context=extra_context or "",
                    )

        # ── ML Fallback ──────────────────────────────────────
        if not gemini_result:
            logger.warning("⚠️ Gemini unavailable/failed → ML Pipeline fallback")

            # Extract text
            if temp_path:
                extraction = await TextExtractor.extract(
                    file_type=file_type,
                    file_path=temp_path,
                    raw_text=raw_text or "",
                )
                text = extraction.get("text", "")
            else:
                text = (raw_text or extra_context or "").strip()

            if not text or len(text.strip()) < 5:
                return {
                    "success": False,
                    "error": "No content to analyze — please provide text or upload a file",
                    "urgency_score": 0,
                    "severity_level": "info",
                    "category": "Other",
                    "summary": "Could not extract content from the provided input",
                    "detailed_analysis": "The report did not contain analyzable content.",
                    "key_problems": ["No content provided"],
                    "suggested_actions": [
                        "Provide a detailed text description",
                        "Upload a clear document or image",
                        "Record a voice message describing the issue"
                    ],
                    "keywords": [],
                    "affected_people": None,
                    "affected_area": None,
                    "immediate_risk": False,
                    "sentiment": "neutral",
                    "confidence_score": 0.0,
                    "root_causes": [],
                    "risk_factors": [],
                    "resources_needed": [],
                    "stakeholders": [],
                    "timeline": "unknown",
                    "similar_issues": "",
                    "field_notes": "",
                    "model_used": "none",
                    "report_id": report_id,
                    "processing_time": round(time.time() - start_time, 3),
                }

            # Run ML pipeline
            ml_results = MLAnalyzer.analyze(text=text, has_file=file is not None)

            return {
                "success": True,
                "report_id": report_id,
                "original_text": text[:2000],
                "urgency_score": ml_results.get("urgency_score", 0),
                "severity_level": ml_results.get("severity_level", "info"),
                "category": ml_results.get("category", "Other"),
                "category_confidence": ml_results.get("category_confidence", 0),
                "sentiment": ml_results.get("sentiment", "neutral"),
                "sentiment_score": ml_results.get("sentiment_score", 0),
                "summary": ml_results.get("summary", ""),
                "detailed_analysis": ml_results.get("detailed_analysis", ""),
                "key_problems": ml_results.get("key_problems", []),
                "suggested_actions": ml_results.get("suggested_actions", []),
                "keywords": ml_results.get("keywords", []),
                "root_causes": [],
                "risk_factors": [],
                "resources_needed": [],
                "stakeholders": [],
                "affected_people": ml_results.get("affected_people"),
                "affected_area": ml_results.get("affected_area"),
                "immediate_risk": ml_results.get("immediate_risk", False),
                "timeline": "within 1 week",
                "similar_issues": "",
                "field_notes": "",
                "confidence_score": ml_results.get("confidence_score", 0.0),
                "explanation": ml_results.get("explanation", ""),
                "model_used": "ml-pipeline-v5-fallback",
                "processing_time": round(time.time() - start_time, 3),
            }

        # ── Gemini Success — Format Response ─────────────────
        elapsed = time.time() - start_time
        logger.info(
            f"✅ Analysis complete | "
            f"Score: {gemini_result.get('urgency_score')} | "
            f"Severity: {gemini_result.get('severity_level')} | "
            f"Category: {gemini_result.get('category')} | "
            f"Time: {elapsed:.2f}s"
        )

        extracted_text = gemini_result.pop("extracted_text", "") or raw_text or ""

        return {
            "success": True,
            "report_id": report_id,
            "original_text": str(extracted_text)[:3000],
            "urgency_score": int(gemini_result.get("urgency_score", 0)),
            "severity_level": str(gemini_result.get("severity_level", "info")),
            "category": str(gemini_result.get("category", "Other")),
            "category_confidence": float(gemini_result.get("confidence_score", 0.8)),
            "sentiment": str(gemini_result.get("sentiment", "neutral")),
            "sentiment_score": 0.0,
            "summary": str(gemini_result.get("summary", "")),
            "detailed_analysis": str(gemini_result.get("detailed_analysis", "")),
            "field_notes": str(gemini_result.get("field_notes", "")),
            "visual_observations": str(gemini_result.get("visual_observations", "")),
            "key_problems": list(gemini_result.get("key_problems", [])),
            "suggested_actions": list(gemini_result.get("suggested_actions", [])),
            "keywords": list(gemini_result.get("keywords", [])),
            "root_causes": list(gemini_result.get("root_causes", [])),
            "risk_factors": list(gemini_result.get("risk_factors", [])),
            "resources_needed": list(gemini_result.get("resources_needed", [])),
            "stakeholders": list(gemini_result.get("stakeholders", [])),
            "affected_people": gemini_result.get("affected_people"),
            "affected_area": gemini_result.get("affected_area"),
            "immediate_risk": bool(gemini_result.get("immediate_risk", False)),
            "timeline": str(gemini_result.get("timeline", "")),
            "similar_issues": str(gemini_result.get("similar_issues", "")),
            "confidence_score": float(gemini_result.get("confidence_score", 0.85)),
            "explanation": f"Analyzed by {gemini_result.get('model_used', 'gemini')}",
            "model_used": str(gemini_result.get("model_used", "gemini")),
            "pdf_pages": gemini_result.get("pdf_pages"),
            "pdf_chars": gemini_result.get("pdf_chars"),
            "processing_time": round(elapsed, 3),
        }

    except Exception as e:
        logger.error(f"❌ Analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

    finally:
        # Always clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                logger.debug(f"🗑️ Cleaned up: {temp_path}")
            except Exception as cleanup_err:
                logger.warning(f"⚠️ Could not delete temp file: {cleanup_err}")


@app.post("/chat")
async def chat_about_report(request: ChatRequest):
    logger.info(
        f"💬 Chat | report={request.report_id} | "
        f"msg='{request.message[:60]}' | "
        f"history={len(request.history or [])}"
    )

    try:
        result = await chat_service.handle_message(
            report_id=request.report_id,
            message=request.message,
            report_data=request.report_data or {},
            history=request.history or [],
        )
        return result
    except Exception as e:
        logger.error(f"❌ Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"🚀 Starting NGO ML Service on port {port}")
    logger.info(f"🤖 Gemini: {'✅ Ready' if gemini_service.available else '❌ Unavailable'}")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
