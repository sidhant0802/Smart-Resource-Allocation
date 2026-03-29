import re
import logging
from typing import Tuple, List
from textblob import TextBlob

logger = logging.getLogger(__name__)

# ── Domain-specific sentiment word lists ─────────────────────
VERY_NEGATIVE_WORDS = [
    "died", "death", "killed", "murdered", "raped", "collapsed",
    "destroyed", "catastrophe", "devastated", "starving", "fatal",
    "critical", "epidemic", "outbreak", "emergency", "disaster",
    "tragedy", "horrific", "terrible", "awful", "devastating",
    "unbearable", "suffering", "desperate", "hopeless",
]

NEGATIVE_WORDS = [
    "sick", "injured", "homeless", "hunger", "contaminated",
    "broken", "damaged", "blocked", "shortage", "lacking",
    "problem", "issue", "complaint", "concern", "difficult",
    "struggling", "suffering", "poor", "bad", "unsafe",
    "unhealthy", "polluted", "flooded", "accident", "hurt",
    "delay", "failure", "neglect", "ignored", "denied",
]

POSITIVE_WORDS = [
    "resolved", "fixed", "improved", "better", "good",
    "helped", "provided", "supported", "working", "clean",
    "safe", "healthy", "available", "accessible", "completed",
]

# ── Intensifiers ──────────────────────────────────────────────
INTENSIFIERS = [
    "very", "extremely", "highly", "severely", "critically",
    "badly", "terribly", "absolutely", "completely", "totally",
]

# ── Hindi sentiment words ─────────────────────────────────────
HINDI_NEGATIVE = [
    "बहुत बुरा", "परेशान", "दुखी", "पीड़ित", "समस्या",
    "मदद चाहिए", "तकलीफ", "मुसीबत",
]


class SentimentAnalyzer:
    """
    Multi-layer sentiment analysis:
    1. TextBlob base sentiment
    2. Domain keyword adjustment
    3. Intensifier detection
    4. Negation handling
    5. Hindi support
    """

    @staticmethod
    def get_textblob_score(text: str) -> float:
        """Get base sentiment from TextBlob (-1 to 1)"""
        try:
            blob = TextBlob(text)
            return blob.sentiment.polarity
        except Exception:
            return 0.0

    @staticmethod
    def count_domain_words(text: str) -> Tuple[int, int, int]:
        """Count very_negative, negative, positive domain words"""
        lower = text.lower()

        very_neg = sum(1 for w in VERY_NEGATIVE_WORDS if w in lower)
        neg      = sum(1 for w in NEGATIVE_WORDS if w in lower)
        pos      = sum(1 for w in POSITIVE_WORDS if w in lower)

        return very_neg, neg, pos

    @staticmethod
    def count_intensifiers(text: str) -> int:
        """Count intensifier words"""
        lower = text.lower()
        return sum(1 for w in INTENSIFIERS if w in lower)

    @staticmethod
    def has_hindi_negative(text: str) -> bool:
        """Check for Hindi negative sentiment"""
        return any(w in text for w in HINDI_NEGATIVE)

    @classmethod
    def analyze(cls, text: str) -> Tuple[str, float, dict]:
        """
        Full sentiment analysis.

        Returns:
            (sentiment_label, score, details)
        """
        # Base score from TextBlob
        base_score = cls.get_textblob_score(text)

        # Domain word counts
        very_neg, neg, pos = cls.count_domain_words(text)

        # Intensifier boost
        intensifier_count = cls.count_intensifiers(text)

        # Hindi check
        hindi_neg = cls.has_hindi_negative(text)

        # Calculate domain adjustment
        domain_adjustment = (
            - (very_neg * 0.20)
            - (neg * 0.08)
            + (pos * 0.05)
            - (intensifier_count * 0.05)
            - (0.15 if hindi_neg else 0)
        )

        # Combined score
        adjusted = base_score + domain_adjustment
        adjusted = max(-1.0, min(1.0, adjusted))

        # Label
        if adjusted < -0.6:   label = "very_negative"
        elif adjusted < -0.2: label = "negative"
        elif adjusted < 0.2:  label = "neutral"
        else:                 label = "positive"

        details = {
            "base_score":       round(base_score, 3),
            "domain_adjustment": round(domain_adjustment, 3),
            "very_negative_words": very_neg,
            "negative_words":   neg,
            "positive_words":   pos,
            "intensifiers":     intensifier_count,
            "hindi_negative":   hindi_neg,
        }

        return label, round(adjusted, 3), details