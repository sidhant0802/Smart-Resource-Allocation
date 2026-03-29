from pydantic import BaseModel
from typing import Optional, List, Any

class AnalysisRequest(BaseModel):
    text:        str
    file_type:   str = "text"
    file_path:   Optional[str] = None
    report_id:   str
    extra_context: Optional[str] = None

class ChatRequest(BaseModel):
    report_id:   str
    message:     str
    report_data: Optional[dict] = None
    history:     Optional[List[dict]] = []

class AnalysisResult(BaseModel):
    urgency_score:     float
    severity_level:    str
    category:          str
    sentiment:         str
    sentiment_score:   float
    summary:           str
    detailed_analysis: str
    key_problems:      List[str]
    suggested_actions: List[str]
    keywords:          List[str]
    affected_people:   Optional[int]
    affected_area:     Optional[str]
    immediate_risk:    bool
    confidence_score:  float
    processing_time:   float
    model_used:        str
    explanation:       str

class ChatResponse(BaseModel):
    message:        str
    recommendation: Optional[str]
    # 'send' | 'draft' | 'neutral'
    confidence:     Optional[float]