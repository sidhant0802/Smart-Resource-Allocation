import re
import time
import logging
import numpy as np
from textblob import TextBlob
from typing import Optional, List, Tuple
from collections import Counter

logger = logging.getLogger(__name__)

# ── Severity Keywords ────────────────────────────────────────
SEVERITY_KEYWORDS = {
    "critical": {
        "weight": 40,
        "words": [
            "death", "dead", "died", "killed", "murder", "rape",
            "sexual assault", "fire", "flood", "earthquake", "tsunami",
            "epidemic", "outbreak", "cholera", "malaria", "dengue",
            "covid", "pandemic", "plague", "famine", "starvation",
            "violence", "attack", "bomb", "explosion", "riot",
            "emergency", "critical", "disaster", "collapse",
            "drowning", "poisoning", "toxic", "lethal",
            "मृत्यु", "बाढ़", "आग", "महामारी", "हत्या",
        ]
    },
    "high": {
        "weight": 25,
        "words": [
            "injury", "injured", "hurt", "serious", "severe",
            "hospital", "urgent", "disease", "sick", "illness",
            "homeless", "hunger", "malnutrition", "abuse",
            "unsafe", "contaminated", "polluted", "hazardous",
            "broken", "collapsed", "accident", "missing",
            "theft", "robbery", "assault", "harassment",
            "बीमार", "भूख", "बेघर", "दुर्घटना", "हमला",
        ]
    },
    "medium": {
        "weight": 15,
        "words": [
            "problem", "issue", "shortage", "lack", "need",
            "damaged", "poor", "bad", "dirty", "smell",
            "garbage", "waste", "blocked", "closed", "delayed",
            "complaint", "difficulty", "concern", "suffering",
            "समस्या", "कमी", "जरूरत", "परेशानी",
        ]
    },
    "low": {
        "weight": 5,
        "words": [
            "suggestion", "improvement", "feedback", "request",
            "query", "information", "update", "follow", "general",
            "सुझाव", "जानकारी", "अनुरोध",
        ]
    }
}

# ── Categories ───────────────────────────────────────────────
CATEGORIES = {
    "Health": {
        "weight": 20,
        "words": [
            "health", "hospital", "doctor", "medicine", "disease",
            "sick", "patient", "medical", "clinic", "vaccine",
            "epidemic", "fever", "malaria", "dengue", "cholera",
            "diarrhea", "infection", "surgery", "ambulance",
        ]
    },
    "Water": {
        "weight": 18,
        "words": [
            "water", "drinking", "supply", "pipeline", "tap",
            "contaminated", "dirty water", "flood", "drought",
            "sewage", "drainage", "sanitation", "toilet",
        ]
    },
    "Sanitation": {
        "weight": 16,
        "words": [
            "sewage", "garbage", "waste", "sanitation", "toilet",
            "drain", "clean", "hygiene", "dirty", "smell",
            "open defecation", "dustbin", "litter",
        ]
    },
    "Food": {
        "weight": 16,
        "words": [
            "food", "hunger", "starvation", "meal", "eating",
            "ration", "nutrition", "malnutrition", "grain",
            "agriculture", "crop", "harvest",
        ]
    },
    "Violence": {
        "weight": 20,
        "words": [
            "violence", "attack", "abuse", "rape", "assault",
            "fight", "murder", "threat", "harassment", "domestic",
            "crime", "theft", "robbery",
        ]
    },
    "Disaster": {
        "weight": 20,
        "words": [
            "flood", "fire", "earthquake", "cyclone", "storm",
            "landslide", "drought", "disaster", "emergency",
            "relief", "rescue",
        ]
    },
    "Education": {
        "weight": 10,
        "words": [
            "school", "education", "student", "teacher", "class",
            "learning", "book", "study", "literacy", "college",
            "dropout", "fees",
        ]
    },
    "Shelter": {
        "weight": 14,
        "words": [
            "house", "shelter", "home", "homeless", "roof",
            "building", "construction", "repair", "collapsed",
            "eviction", "rent",
        ]
    },
    "Infrastructure": {
        "weight": 8,
        "words": [
            "road", "bridge", "electricity", "power", "light",
            "broken", "damaged", "repair", "blocked", "pothole",
        ]
    },
}

class MLAnalyzer:

    @staticmethod
    def detect_category(text: str) -> Tuple[str, float]:
        """Detect report category with confidence"""
        lower = text.lower()
        scores = {}

        for category, data in CATEGORIES.items():
            matches = sum(
                1 for word in data["words"]
                if word in lower
            )
            scores[category] = matches * data["weight"]

        if not any(scores.values()):
            return "Other", 0.0

        top_cat   = max(scores, key=scores.get)
        total     = sum(scores.values())
        confidence = scores[top_cat] / total if total > 0 else 0

        return top_cat, round(confidence, 3)

    @staticmethod
    def analyze_sentiment(text: str) -> Tuple[str, float]:
        """Advanced sentiment analysis using TextBlob + keywords"""
        blob  = TextBlob(text)
        score = blob.sentiment.polarity
        # -1 to 1

        # Adjust with domain keywords
        lower = text.lower()
        negative_words = sum(
            1 for w in SEVERITY_KEYWORDS["critical"]["words"]
            if w in lower
        )
        negative_words += sum(
            1 for w in SEVERITY_KEYWORDS["high"]["words"]
            if w in lower
        ) * 0.5

        # More negative words push score down
        adjusted_score = score - (negative_words * 0.1)
        adjusted_score = max(-1.0, min(1.0, adjusted_score))

        if adjusted_score < -0.5:   sentiment = "very_negative"
        elif adjusted_score < -0.1: sentiment = "negative"
        elif adjusted_score < 0.2:  sentiment = "neutral"
        else:                       sentiment = "positive"

        return sentiment, round(adjusted_score, 3)

    @staticmethod
    def extract_keywords(text: str) -> List[str]:
        """Extract important keywords using frequency + domain matching"""
        lower  = text.lower()
        found  = []

        # Domain-specific keywords (high priority)
        for level, data in SEVERITY_KEYWORDS.items():
            for word in data["words"]:
                if word in lower and word not in found:
                    found.append(word)

        # Also get frequent meaningful words
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text)
        stop_words = {
            "that", "this", "with", "have", "from", "they",
            "will", "been", "were", "their", "also", "than",
            "then", "some", "what", "when", "where", "which",
        }
        word_freq = Counter(
            w.lower() for w in words
            if w.lower() not in stop_words
        )

        # Add top frequent words
        for word, count in word_freq.most_common(20):
            if count >= 2 and word not in found:
                found.append(word)

        return found[:10]

    @staticmethod
    def extract_affected_people(text: str) -> Optional[int]:
        """Extract number of affected people from text"""
        patterns = [
            r'(\d+[\,\d]*)\s*(?:people|persons|families|households|villagers|residents|individuals)',
            r'(?:affecting|affected|impacted|displaced)\s*(?:over|about|around|approximately)?\s*(\d+[\,\d]*)',
            r'(\d+[\,\d]*)\s*(?:affected|impacted|homeless|sick|injured)',
            r'population\s*of\s*(\d+[\,\d]*)',
            r'(\d+[\,\d]*)\s*(?:homes|houses|children|families)',
        ]

        found_numbers = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                num_str = match.replace(',', '')
                try:
                    num = int(num_str)
                    if 1 <= num <= 10_000_000:
                        found_numbers.append(num)
                except ValueError:
                    pass

        if found_numbers:
            return max(found_numbers)
            # Return largest number found
        return None

    @staticmethod
    def extract_location(text: str) -> Optional[str]:
        """Extract location mentions from text"""
        patterns = [
            r'(?:in|at|near|village|district|block|area|region|zone)\s+([A-Z][a-zA-Z\s]{2,30})',
            r'([A-Z][a-zA-Z\s]{2,20})\s+(?:district|block|village|taluka|panchayat)',
        ]

        locations = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            locations.extend([m.strip() for m in matches if len(m.strip()) > 2])

        return locations[0] if locations else None

    @classmethod
    def calculate_urgency_score(
        cls,
        text:           str,
        sentiment:      str,
        category:       str,
        has_file:       bool,
        affected_people: Optional[int],
    ) -> Tuple[float, str, str]:
        """
        Calculate urgency score 0-100
        Returns: (score, severity_level, explanation)
        """
        lower  = text.lower()
        scores = {}
        explanation_parts = []

        # 1. Keyword severity (40 points max)
        keyword_score = 0
        for level, data in SEVERITY_KEYWORDS.items():
            matches = [w for w in data["words"] if w in lower]
            if matches:
                pts = min(data["weight"], len(matches) * (data["weight"] / 3))
                keyword_score = max(keyword_score, pts)
                explanation_parts.append(
                    f"Found {level} keywords: {', '.join(matches[:3])}"
                )

        scores["keywords"] = min(40, keyword_score)

        # 2. Sentiment (20 points)
        sentiment_pts = {
            "very_negative": 20,
            "negative":      14,
            "neutral":       5,
            "positive":      2,
        }
        scores["sentiment"] = sentiment_pts.get(sentiment, 5)
        explanation_parts.append(f"Sentiment: {sentiment}")

        # 3. Category weight (20 points)
        cat_weights = {
            "Health":         20, "Violence":  20,
            "Disaster":       20, "Water":     18,
            "Food":           16, "Sanitation": 16,
            "Shelter":        14, "Education": 10,
            "Infrastructure": 8,  "Other":      5,
        }
        scores["category"] = cat_weights.get(category, 5)
        explanation_parts.append(f"Category: {category}")

        # 4. File proof (10 points)
        scores["file"] = 10 if has_file else 3

        # 5. Affected people (10 points)
        if affected_people:
            if affected_people > 1000:  people_pts = 10
            elif affected_people > 500: people_pts = 8
            elif affected_people > 100: people_pts = 6
            elif affected_people > 50:  people_pts = 4
            else:                       people_pts = 2
            scores["people"] = people_pts
            explanation_parts.append(
                f"~{affected_people} people affected"
            )
        else:
            scores["people"] = 3

        # Total
        total = sum(scores.values())
        total = max(0.0, min(100.0, float(total)))

        # Severity level
        if total >= 80:   severity = "critical"
        elif total >= 60: severity = "high"
        elif total >= 40: severity = "medium"
        elif total >= 20: severity = "low"
        else:             severity = "info"

        explanation = (
            f"Score {total:.1f}/100 ({severity.upper()}). "
            + " | ".join(explanation_parts)
        )

        return round(total, 1), severity, explanation

    @classmethod
    def analyze(
        cls,
        text:     str,
        has_file: bool = False,
    ) -> dict:
        """Full ML analysis pipeline"""
        start = time.time()

        if not text or len(text.strip()) < 10:
            return {
                "urgency_score":     0,
                "severity_level":    "info",
                "category":          "Other",
                "category_confidence": 0,
                "sentiment":         "neutral",
                "sentiment_score":   0,
                "keywords":          [],
                "affected_people":   None,
                "affected_area":     None,
                "immediate_risk":    False,
                "explanation":       "Insufficient text for analysis",
                "processing_time":   time.time() - start,
            }

        category, cat_confidence = cls.detect_category(text)
        sentiment, sent_score    = cls.analyze_sentiment(text)
        keywords                 = cls.extract_keywords(text)
        affected_people          = cls.extract_affected_people(text)
        affected_area            = cls.extract_location(text)

        urgency_score, severity, explanation = cls.calculate_urgency_score(
            text, sentiment, category, has_file, affected_people
        )

        immediate_risk = (
            urgency_score >= 70 or
            severity in ["critical", "high"] or
            any(w in text.lower() for w in [
                "death", "died", "fire", "flood",
                "epidemic", "emergency", "rape", "murder"
            ])
        )

        return {
            "urgency_score":       urgency_score,
            "severity_level":      severity,
            "category":            category,
            "category_confidence": cat_confidence,
            "sentiment":           sentiment,
            "sentiment_score":     sent_score,
            "keywords":            keywords,
            "affected_people":     affected_people,
            "affected_area":       affected_area,
            "immediate_risk":      immediate_risk,
            "explanation":         explanation,
            "processing_time":     round(time.time() - start, 3),
        }