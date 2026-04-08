# services/analyzer.py

import re
import time
import logging
from typing import Optional, List
from collections import Counter

# ✅ Direct imports (bypass __init__.py aliasing issues)
from services.ml.context_checker    import AdvancedContextChecker
from services.ml.scorer             import UrgencyScorer  # Direct import
from services.ml.category_detector  import CategoryDetector
from services.ml.sentiment_analyzer import SentimentAnalyzer
from services.ml.entity_extractor   import EntityExtractor
from services.ml.text_summarizer    import TextSummarizer
from services.ml.action_generator   import ActionGenerator

logger = logging.getLogger(__name__)


class MLAnalyzer:
    """
    Main ML analysis orchestrator.
    Coordinates all ML sub-modules for accurate report analysis.
    """

    @classmethod
    def extract_keywords(cls, text: str, matched: List[str]) -> List[str]:
        """Get final keyword list combining matched + frequent words"""
        found = list(matched)

        stop_words = {
            "that", "this", "with", "have", "from", "they", "will",
            "been", "were", "their", "also", "than", "then", "some",
            "what", "when", "where", "which", "very", "just", "more",
            "into", "over", "after", "people", "those", "about",
            "would", "could", "should", "there", "here", "they",
        }

        words     = re.findall(r'\b[a-zA-Z]{4,}\b', text)
        word_freq = Counter(
            w.lower() for w in words
            if w.lower() not in stop_words
        )

        for word, count in word_freq.most_common(20):
            if count >= 2 and word not in found:
                found.append(word)

        return found[:10]

    @classmethod
    def analyze(cls, text: str, has_file: bool = False) -> dict:
        """
        Full ML analysis pipeline.
        Uses all sub-modules for maximum accuracy.
        """
        start = time.time()

        # Handle empty text
        if not text or len(text.strip()) < 10:
            return {
                "urgency_score":       0,
                "severity_level":      "info",
                "category":            "Other",
                "category_confidence": 0,
                "sentiment":           "neutral",
                "sentiment_score":     0,
                "summary":             "Insufficient text for analysis",
                "detailed_analysis":   "",
                "key_problems":        [],
                "suggested_actions":   ["Submit a more detailed report"],
                "keywords":            [],
                "affected_people":     None,
                "affected_area":       None,
                "immediate_risk":      False,
                "confidence_score":    0.0,
                "explanation":         "Text too short for analysis",
                "processing_time":     round(time.time() - start, 3),
                "model_used":          "ml-pipeline-v4-advanced",
            }

        logger.info(f"Analyzing {len(text)} chars")

        # ── Step 1: Category Detection ────────────────────────
        category, cat_conf, all_cat_scores = CategoryDetector.detect(text)
        logger.info(f"Category: {category} ({cat_conf:.2f})")

        # ── Step 2: Sentiment Analysis ────────────────────────
        sentiment, sent_score, sent_details = SentimentAnalyzer.analyze(text)
        logger.info(f"Sentiment: {sentiment} ({sent_score:.2f})")

        # ── Step 3: Entity Extraction ─────────────────────────
        entities         = EntityExtractor.extract_all(text)
        affected_people  = entities["affected_people"]
        affected_area    = entities["location"]
        indicators       = entities["indicators"]
        time_refs        = entities["time_refs"]
        logger.info(
            f"People: {affected_people} | Area: {affected_area} | "
            f"TimeRefs: {time_refs}"
        )

        # ── Step 4: Urgency Scoring ───────────────────────────
        try:
            score, severity, explanation, matched_kw = UrgencyScorer.calculate(
                text=text,
                sentiment=sentiment,
                category=category,
                has_file=has_file,
                affected_people=affected_people,
                indicators=indicators,
            )
            logger.info(f"Score: {score} | Severity: {severity}")
        except Exception as e:
            logger.error(f"Scoring failed: {e}", exc_info=True)
            # Fallback scoring
            score = 30.0
            severity = "medium"
            explanation = f"Fallback score (error: {str(e)[:50]})"
            matched_kw = []

        # ── Step 5: Keyword Extraction ────────────────────────
        keywords = cls.extract_keywords(text, matched_kw)

        # ── Step 6: Immediate Risk Detection ─────────────────
        critical_confirmed = False
        try:
            critical_keywords = [
                "confirmed dead", "found dead", "death confirmed",
                "building collapsed", "epidemic confirmed",
            ]
            
            for kw in critical_keywords:
                is_valid, confidence, _ = AdvancedContextChecker.verify_keyword(
                    text, kw, requires_strong_evidence=True
                )
                if is_valid and confidence >= 0.5:
                    critical_confirmed = True
                    break
        except:
            pass

        immediate_risk = (
            score >= 75 or
            (score >= 60 and critical_confirmed) or
            severity == "critical" or
            indicators.get("has_deaths", False) or
            (indicators.get("has_disease", False) and score >= 55)
        )

        # ── Step 7: Summary Generation ────────────────────────
        summary = TextSummarizer.generate_short_summary(
            text=text,
            category=category,
            severity=severity,
            urgency_score=score,
            keywords=keywords,
            affected_people=affected_people,
            affected_area=affected_area,
            immediate_risk=immediate_risk,
        )

        detailed = TextSummarizer.generate_detailed_analysis(
            text=text,
            category=category,
            severity=severity,
            urgency_score=score,
            keywords=keywords,
            affected_people=affected_people,
            affected_area=affected_area,
            immediate_risk=immediate_risk,
            matched_keywords=matched_kw,
            sentiment=sentiment,
        )

        # ── Step 8: Key Problems ──────────────────────────────
        key_problems = TextSummarizer.generate_key_problems(text, keywords)

        # ── Step 9: Action Generation ─────────────────────────
        suggested_actions = ActionGenerator.generate(
            severity=severity,
            category=category,
            immediate=immediate_risk,
            text=text,
        )

        # ── Confidence Score ──────────────────────────────────
        confidence = min(
            0.95,
            cat_conf + 0.2 + (0.1 if has_file else 0)
        )

        processing_time = round(time.time() - start, 3)

        logger.info(
            f"✅ Analysis complete | Score: {score} | "
            f"Severity: {severity} | Category: {category} | "
            f"ImmediateRisk: {immediate_risk} | Time: {processing_time}s"
        )

        return {
            "urgency_score":       score,
            "severity_level":      severity,
            "category":            category,
            "category_confidence": cat_conf,
            "sentiment":           sentiment,
            "sentiment_score":     sent_score,
            "summary":             summary,
            "detailed_analysis":   detailed,
            "key_problems":        key_problems,
            "suggested_actions":   suggested_actions,
            "keywords":            keywords,
            "affected_people":     affected_people,
            "affected_area":       affected_area,
            "immediate_risk":      immediate_risk,
            "confidence_score":    round(confidence, 2),
            "explanation":         explanation,
            "processing_time":     processing_time,
            "model_used":          "ml-pipeline-v4-advanced",
        }