# import os
# import time
# import logging
# import tempfile
# from typing import Optional

# import aiofiles
# import uvicorn
# from fastapi import FastAPI, UploadFile, File, Form, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from dotenv import load_dotenv

# from models.schemas import ChatRequest
# from services.extractor import TextExtractor
# from services.analyzer import MLAnalyzer
# from services.gemini_service import gemini_service
# from services.chat_service import chat_service

# load_dotenv()

# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)

# app = FastAPI(
#     title="NGO ML Analysis Service",
#     version="2.0.0",
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.get("/health")
# async def health():
#     return {
#         "status": "OK",
#         "service": "Python ML Service",
#         "version": "2.0.0",
#     }

# @app.post("/analyze")
# async def analyze_report(
#     file: Optional[UploadFile] = File(None),
#     file_type: str = Form("text"),
#     raw_text: Optional[str] = Form(""),
#     report_id: str = Form(...),
#     extra_context: Optional[str] = Form(""),
# ):
#     start_time = time.time()
#     temp_path = None

#     logger.info(f"Analyzing report {report_id} | type={file_type}")

#     try:
#         if file and file.filename:
#             suffix = os.path.splitext(file.filename)[1]
#             tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
#             content = await file.read()
#             tmp.write(content)
#             tmp.close()
#             temp_path = tmp.name
#             logger.info(f"Saved temp file: {temp_path}")

#         extraction = await TextExtractor.extract(
#             file_type=file_type,
#             file_path=temp_path,
#             raw_text=raw_text or extra_context or "",
#         )

#         text = extraction.get("text", "")
#         logger.info(f"Extracted {len(text)} chars")

#         if not text or len(text.strip()) < 5:
#             return {
#                 "success": False,
#                 "error": "Could not extract text from file",
#                 "urgency_score": 0,
#                 "severity_level": "info",
#                 "summary": "No content extracted",
#             }

#         logger.info("Running ML pipeline...")
#         ml_results = MLAnalyzer.analyze(
#             text=text,
#             has_file=file is not None,
#         )
#         logger.info(
#             f"ML Score: {ml_results['urgency_score']} ({ml_results['severity_level']})"
#         )

#         logger.info("Calling Gemini AI...")
#         gemini_results = await gemini_service.analyze_report(
#             text=text,
#             ml_results=ml_results,
#         )
#         logger.info(
#             f"Gemini Score: {gemini_results['urgency_score']} ({gemini_results['severity_level']})"
#         )

#         final = {
#             "success": True,
#             "report_id": report_id,
#             "original_text": text[:2000],
#             "urgency_score": gemini_results["urgency_score"],
#             "severity_level": gemini_results["severity_level"],
#             "category": ml_results["category"],
#             "category_confidence": ml_results["category_confidence"],
#             "sentiment": ml_results["sentiment"],
#             "sentiment_score": ml_results["sentiment_score"],
#             "summary": gemini_results["summary"],
#             "detailed_analysis": gemini_results["detailed_analysis"],
#             "key_problems": gemini_results["key_problems"],
#             "suggested_actions": gemini_results["suggested_actions"],
#             "keywords": ml_results["keywords"],
#             "affected_people": ml_results["affected_people"],
#             "affected_area": ml_results["affected_area"],
#             "immediate_risk": gemini_results["immediate_risk"],
#             "confidence_score": gemini_results["confidence_score"],
#             "reasoning": gemini_results.get("reasoning", ""),
#             "explanation": ml_results["explanation"],
#             "model_used": gemini_results["model_used"],
#             "processing_time": round(time.time() - start_time, 3),
#         }

#         logger.info(
#             f"✅ Final Score: {final['urgency_score']} ({final['severity_level']}) | Confidence: {final['confidence_score']}"
#         )

#         return final

#     except Exception as e:
#         logger.error(f"Analysis error: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))

#     finally:
#         if temp_path and os.path.exists(temp_path):
#             os.unlink(temp_path)

# @app.post("/chat")
# async def chat_about_report(request: ChatRequest):
#     logger.info(f"Chat: report={request.report_id} msg='{request.message[:50]}'")

#     result = await chat_service.handle_message(
#         report_id=request.report_id,
#         message=request.message,
#         report_data=request.report_data or {},
#         history=request.history or [],
#     )

#     return result

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 8000))
#     uvicorn.run(
#         "main:app",
#         host="0.0.0.0",
#         port=port,
#         reload=True,
#     )


























import os
import time
import logging
import tempfile
from typing import Optional

import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import ChatRequest
from services.extractor import TextExtractor
from services.analyzer import MLAnalyzer
from services.gemini_service import gemini_service
from services.chat_service import chat_service

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="NGO ML Analysis Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status":  "OK",
        "service": "NGO ML Service",
        "version": "3.0.0",
        "mode":    "ML analysis + Gemini chat",
    }

# ── Analysis: Pure ML, no Gemini ────────────────────────────
@app.post("/analyze")
async def analyze_report(
    file:          Optional[UploadFile] = File(None),
    file_type:     str                  = Form("text"),
    raw_text:      Optional[str]        = Form(""),
    report_id:     str                  = Form(...),
    extra_context: Optional[str]        = Form(""),
):
    start_time = time.time()
    temp_path  = None

    logger.info(f"📊 Analyzing report {report_id} | type={file_type}")

    try:
        # Save uploaded file
        if file and file.filename:
            suffix    = os.path.splitext(file.filename)[1]
            tmp       = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            content   = await file.read()
            tmp.write(content)
            tmp.close()
            temp_path = tmp.name

        # Step 1: Extract text
        extraction = await TextExtractor.extract(
            file_type=file_type,
            file_path=temp_path,
            raw_text=raw_text or extra_context or "",
        )

        text = extraction.get("text", "")
        logger.info(f"📝 Extracted {len(text)} chars")

        if not text or len(text.strip()) < 5:
            return {
                "success":         False,
                "error":           "Could not extract text",
                "urgency_score":   0,
                "severity_level":  "info",
                "summary":         "No content extracted",
                "key_problems":    [],
                "suggested_actions": ["Submit more detailed report"],
                "keywords":        [],
                "model_used":      "ml-pipeline-v2",
            }

        # Step 2: Advanced ML Analysis (no Gemini)
        logger.info("🤖 Running advanced ML pipeline...")
        ml_results = MLAnalyzer.analyze(
            text=text,
            has_file=file is not None,
        )

        logger.info(
            f"✅ ML Score: {ml_results['urgency_score']} "
            f"({ml_results['severity_level']}) | "
            f"Category: {ml_results['category']}"
        )

        return {
            "success":             True,
            "report_id":           report_id,
            "original_text":       text[:2000],
            "urgency_score":       ml_results["urgency_score"],
            "severity_level":      ml_results["severity_level"],
            "category":            ml_results["category"],
            "category_confidence": ml_results["category_confidence"],
            "sentiment":           ml_results["sentiment"],
            "sentiment_score":     ml_results["sentiment_score"],
            "summary":             ml_results["summary"],
            "detailed_analysis":   ml_results["detailed_analysis"],
            "key_problems":        ml_results["key_problems"],
            "suggested_actions":   ml_results["suggested_actions"],
            "keywords":            ml_results["keywords"],
            "affected_people":     ml_results["affected_people"],
            "affected_area":       ml_results["affected_area"],
            "immediate_risk":      ml_results["immediate_risk"],
            "confidence_score":    ml_results["confidence_score"],
            "explanation":         ml_results["explanation"],
            "model_used":          ml_results["model_used"],
            "processing_time":     round(time.time() - start_time, 3),
        }

    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

# ── Chat: Gemini only ────────────────────────────────────────
@app.post("/chat")
async def chat_about_report(request: ChatRequest):
    logger.info(f"💬 Chat: report={request.report_id} | msg='{request.message[:50]}'")

    result = await chat_service.handle_message(
        report_id=request.report_id,
        message=request.message,
        report_data=request.report_data or {},
        history=request.history or [],
    )

    return result

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)