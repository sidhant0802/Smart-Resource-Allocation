from pydantic import BaseModel, Field, validator
from typing import Optional, List, Any


class AnalysisRequest(BaseModel):
    text: str
    file_type: str = "text"
    file_path: Optional[str] = None
    report_id: str
    extra_context: Optional[str] = None


class ChatRequest(BaseModel):
    report_id: str
    message: str = Field(..., min_length=1, max_length=2000)
    report_data: Optional[dict] = {}
    history: Optional[List[dict]] = []

    @validator('message')
    def message_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Message cannot be empty')
        return v.strip()


class AnalysisResult(BaseModel):
    success: bool = True
    report_id: str
    urgency_score: float = Field(ge=0, le=100)
    severity_level: str
    category: str
    sentiment: str
    sentiment_score: float = 0.0
    summary: str
    detailed_analysis: str
    key_problems: List[str] = []
    suggested_actions: List[str] = []
    keywords: List[str] = []
    root_causes: List[str] = []
    risk_factors: List[str] = []
    resources_needed: List[str] = []
    stakeholders: List[str] = []
    affected_people: Optional[int] = None
    affected_area: Optional[str] = None
    immediate_risk: bool = False
    timeline: Optional[str] = None
    similar_issues: Optional[str] = None
    field_notes: Optional[str] = None
    visual_observations: Optional[str] = None
    confidence_score: float = Field(ge=0.0, le=1.0)
    processing_time: float
    model_used: str
    explanation: Optional[str] = None


class ChatResponse(BaseModel):
    success: bool = True
    message: str
    recommendation: Optional[str] = "neutral"
    confidence: Optional[float] = 0.7
    report_id: Optional[str] = None