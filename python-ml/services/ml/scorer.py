import re
import logging
from typing import Tuple, Dict, Optional, List
from .context_checker import ContextChecker

logger = logging.getLogger(__name__)

# ── Severity Keyword Bank ─────────────────────────────────────
SEVERITY_KEYWORDS = {
    "critical": {
        "base_weight":    40,
        "needs_evidence": True,   # ✅ MUST have evidence words nearby
        "words": [
            # Only very specific confirmed-incident phrases
            "confirmed dead", "found dead", "body found",
            "bodies found", "death confirmed", "fatality reported",
            "fatalities reported", "casualty reported",
            "killed on spot", "murdered yesterday",
            "rape reported", "rape case filed",
            "fire broke out", "fire has broken",
            "flood has hit", "flood struck",
            "earthquake hit", "building collapsed today",
            "bridge collapsed", "dam broke",
            "epidemic confirmed", "outbreak confirmed",
            "cholera confirmed", "dengue outbreak",
            "mass poisoning", "food poisoning case",
            "child died today", "patient died",
            "starvation death", "died of hunger",
            "मृत्यु हुई", "मर गया", "मर गई",
            "मौत हो गई", "शव मिला",
        ],
    },
    "high": {
        "base_weight":    25,
        "needs_evidence": False,
        "words": [
            "admitted to hospital", "hospitalized",
            "serious injury", "critically injured",
            "severely injured", "unconscious person",
            "disease is spreading", "infection spreading",
            "many people are sick", "children are sick",
            "people falling sick", "falling ill",
            "families are homeless", "people displaced",
            "no shelter available", "living on street",
            "severe hunger", "people are starving",
            "no food for days", "going without food",
            "water is contaminated", "water supply dirty",
            "no drinking water", "water shortage here",
            "physical abuse reported", "domestic violence here",
            "beaten badly", "sexual harassment reported",
            "child abuse case", "toxic waste here",
            "बीमार पड़ रहे", "भूखे हैं", "बेघर हो गए",
        ],
    },
    "medium": {
        "base_weight":    15,
        "needs_evidence": False,
        "words": [
            "road is broken", "road is damaged",
            "potholes on road", "no electricity for",
            "power cut since", "frequent power cuts",
            "garbage not collected", "waste piling up",
            "drain is blocked", "sewer overflowing",
            "no teacher in school", "teacher absent",
            "water supply irregular", "no water supply",
            "toilet not working", "no toilet here",
            "समस्या बनी हुई है", "दिक्कत हो रही है",
        ],
    },
    "low": {
        "base_weight":    5,
        "needs_evidence": False,
        "words": [
            "would like to suggest", "improvement needed",
            "general feedback", "requesting information",
            "minor issue", "slight delay",
            "सुझाव है", "जानकारी चाहिए",
        ],
    },
}

# ── Vulnerability Multipliers ─────────────────────────────────
VULNERABILITY_MULTIPLIERS = {
    "children":       1.35,
    "infant":         1.40,
    "pregnant":       1.35,
    "women":          1.20,
    "elderly":        1.20,
    "disabled":       1.25,
    "remote area":    1.15,
    "tribal":         1.15,
    "minority":       1.10,
    "recurring":      1.15,
    "repeated":       1.10,
    "ignored":        1.10,
    "already fixed":  0.40,
    "resolved":       0.35,
    "under control":  0.50,
}

# ── Category Base Weights ─────────────────────────────────────
CATEGORY_WEIGHTS = {
    "Health":         20,
    "Violence":       20,
    "Disaster":       20,
    "Water":          18,
    "Food":           16,
    "Sanitation":     16,
    "Shelter":        14,
    "Education":      10,
    "Infrastructure":  8,
    "Other":           5,
}


class UrgencyScorer:
    """
    Multi-factor urgency scoring system:
    1. Context-verified keyword scoring
    2. Sentiment contribution
    3. Category severity weight
    4. Evidence presence (file/photo)
    5. Affected people scale
    6. Vulnerability multipliers
    7. Time urgency detection
    """

    @staticmethod
    def score_keywords(text: str) -> Tuple[float, List[str]]:
        """
        Score keywords with context verification.
        Returns (score 0-40, matched keywords)
        """
        max_score = 0.0
        matched   = []

        for level, data in SEVERITY_KEYWORDS.items():
            level_matches  = []
            level_score    = 0.0

            for word in data["words"]:
                is_valid, confidence = ContextChecker.verify_keyword(
                    text=text,
                    keyword=word,
                    requires_evidence=data["needs_evidence"],
                )

                if is_valid:
                    # Score = base_weight * confidence
                    word_score = data["base_weight"] * confidence
                    level_score += word_score
                    level_matches.append(word)

            if level_matches:
                # Cap at base_weight for this level
                capped = min(data["base_weight"], level_score)
                max_score = max(max_score, capped)
                matched.extend(level_matches[:3])

        return round(min(40.0, max_score), 2), matched[:8]

    @staticmethod
    def score_sentiment(sentiment: str) -> float:
        """Convert sentiment to score (0-20)"""
        return {
            "very_negative": 20.0,
            "negative":      14.0,
            "neutral":        5.0,
            "positive":       2.0,
        }.get(sentiment, 5.0)

    @staticmethod
    def score_category(category: str) -> float:
        """Category-based score (0-20)"""
        return float(CATEGORY_WEIGHTS.get(category, 5))

    @staticmethod
    def score_evidence(
        has_file:    bool,
        indicators:  Dict[str, bool],
    ) -> float:
        """Score based on evidence (0-10)"""
        score = 10.0 if has_file else 3.0

        # Boost if multiple types of evidence
        indicator_count = sum(1 for v in indicators.values() if v)
        score += min(5.0, indicator_count * 0.5)

        return min(10.0, score)

    @staticmethod
    def score_affected_people(count: Optional[int]) -> float:
        """Score based on affected people count (0-10)"""
        if not count:
            return 2.0
        if count > 10000: return 10.0
        if count > 1000:  return 9.0
        if count > 500:   return 7.0
        if count > 100:   return 5.0
        if count > 50:    return 4.0
        if count > 10:    return 3.0
        return 2.0

    @staticmethod
    def get_vulnerability_multiplier(text: str) -> Tuple[float, List[str]]:
        """Get vulnerability multiplier from text"""
        lower      = text.lower()
        multiplier = 1.0
        reasons    = []

        for context, mult in VULNERABILITY_MULTIPLIERS.items():
            if context in lower:
                multiplier *= mult
                if mult > 1.0:
                    reasons.append(f"involves {context}")
                elif mult < 1.0:
                    reasons.append(f"situation {context}")

        return round(min(multiplier, 1.6), 3), reasons

    @staticmethod
    def detect_time_urgency(text: str) -> float:
        """Extra score if report mentions urgent time context"""
        lower   = text.lower()
        urgency = 0.0

        urgent_time_words = [
            "right now", "immediately", "urgent", "asap",
            "cannot wait", "critical now", "happening now",
            "ongoing", "still happening", "not stopped",
        ]

        for word in urgent_time_words:
            if word in lower:
                urgency += 2.0

        return min(10.0, urgency)

    @classmethod
    def calculate(
        cls,
        text:            str,
        sentiment:       str,
        category:        str,
        has_file:        bool,
        affected_people: Optional[int],
        indicators:      Dict[str, bool],
    ) -> Tuple[float, str, str, List[str]]:
        """
        Master scoring function.

        Returns:
            (score, severity_level, explanation, matched_keywords)
        """
        # Individual scores
        kw_score,  matched    = cls.score_keywords(text)
        sent_score            = cls.score_sentiment(sentiment)
        cat_score             = cls.score_category(category)
        evid_score            = cls.score_evidence(has_file, indicators)
        people_score          = cls.score_affected_people(affected_people)
        time_score            = cls.detect_time_urgency(text)
        multiplier, vuln_info = cls.get_vulnerability_multiplier(text)

        # Raw total (max ~110 before multiplier)
        raw_total = (
            kw_score +
            sent_score +
            cat_score +
            evid_score +
            people_score +
            time_score
        )

        # Apply vulnerability multiplier
        final = raw_total * multiplier
        final = round(max(0.0, min(100.0, final)), 1)

        # Severity level
        if final >= 80:   severity = "critical"
        elif final >= 60: severity = "high"
        elif final >= 40: severity = "medium"
        elif final >= 20: severity = "low"
        else:             severity = "info"

        # Explanation
        parts = [
            f"Keywords({kw_score:.1f})",
            f"Sentiment({sent_score:.1f})",
            f"Category({cat_score:.1f})",
            f"Evidence({evid_score:.1f})",
            f"People({people_score:.1f})",
        ]
        if time_score > 0:
            parts.append(f"TimeUrgency({time_score:.1f})")
        if multiplier != 1.0:
            parts.append(f"Multiplier(x{multiplier})")

        explanation = (
            f"Score {final}/100 ({severity.upper()}) = "
            + " + ".join(parts)
            + (f" | Vulnerable groups: {', '.join(vuln_info)}" if vuln_info else "")
        )

        return final, severity, explanation, matched