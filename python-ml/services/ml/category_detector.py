import re
import logging
from typing import Tuple, Dict, List
from collections import defaultdict

logger = logging.getLogger(__name__)

# ── Category Definitions ──────────────────────────────────────
CATEGORIES: Dict[str, Dict] = {
    "Health": {
        "weight": 20,
        "primary": [
            "hospital", "doctor", "medicine", "disease", "sick",
            "patient", "medical", "clinic", "vaccine", "epidemic",
            "fever", "malaria", "dengue", "cholera", "diarrhea",
            "infection", "surgery", "ambulance", "health center",
            "symptoms", "treatment", "pharmacy", "asha worker",
            "health camp", "blood", "vomiting", "rash",
        ],
        "secondary": [
            "pain", "weak", "ill", "care", "nurse", "bed",
            "ward", "icu", "injection", "tablet", "capsule",
        ],
        "hindi": [
            "बीमार", "दवाई", "अस्पताल", "डॉक्टर", "बुखार",
        ],
    },
    "Water": {
        "weight": 18,
        "primary": [
            "drinking water", "water supply", "pipeline", "tap water",
            "contaminated water", "dirty water", "water shortage",
            "no water", "borewell", "handpump", "water source",
            "pond", "well", "water tank", "water pump", "tube well",
            "water crisis", "water problem",
        ],
        "secondary": [
            "thirsty", "dehydrated", "water", "liquid", "fluid",
            "rain water", "ground water",
        ],
        "hindi": [
            "पानी", "पीने का पानी", "जल", "नल",
        ],
    },
    "Sanitation": {
        "weight": 16,
        "primary": [
            "sewage", "garbage", "waste", "sanitation", "toilet",
            "drain", "hygiene", "dirty", "smell", "stench",
            "open defecation", "dustbin", "litter", "mosquito",
            "rats", "rodent", "pest", "drainage blocked",
            "garbage dump", "waste disposal",
        ],
        "secondary": [
            "clean", "cleanliness", "filth", "mud", "sewer",
            "latrine", "bathroom",
        ],
        "hindi": [
            "गंदगी", "सफाई", "शौचालय", "नाली", "कचरा",
        ],
    },
    "Food": {
        "weight": 16,
        "primary": [
            "food", "hunger", "starvation", "meal", "eating",
            "ration", "nutrition", "malnutrition", "grain",
            "crop", "harvest", "anganwadi", "midday meal",
            "ration card", "pds", "food supply", "food shortage",
            "no food", "starving", "famine",
        ],
        "secondary": [
            "eat", "hungry", "feed", "cook", "kitchen",
            "rice", "wheat", "dal", "vegetable",
        ],
        "hindi": [
            "भोजन", "भूख", "राशन", "खाना", "अनाज",
        ],
    },
    "Violence": {
        "weight": 20,
        "primary": [
            "violence", "attack", "abuse", "assault", "fight",
            "murder", "threat", "harassment", "domestic violence",
            "crime", "theft", "robbery", "beating", "molest",
            "rape", "sexual assault", "kidnap", "missing person",
            "physical abuse", "child abuse", "mob",
        ],
        "secondary": [
            "hit", "hurt", "beat", "punch", "wound",
            "weapon", "knife", "gun",
        ],
        "hindi": [
            "हिंसा", "मारपीट", "बलात्कार", "चोरी", "हमला",
        ],
    },
    "Disaster": {
        "weight": 20,
        "primary": [
            "flood", "fire", "earthquake", "cyclone", "storm",
            "landslide", "drought", "disaster", "emergency",
            "relief", "rescue", "natural disaster", "tornado",
            "lightning strike", "building collapse", "dam break",
            "cloud burst", "heavy rain damage",
        ],
        "secondary": [
            "destroyed", "damage", "collapse", "swept",
            "trapped", "buried", "rescue team",
        ],
        "hindi": [
            "बाढ़", "आग", "भूकंप", "तूफान", "सूखा",
        ],
    },
    "Education": {
        "weight": 10,
        "primary": [
            "school", "education", "student", "teacher", "class",
            "learning", "literacy", "college", "dropout",
            "fees", "scholarship", "midday meal", "books",
            "study", "exam", "school building", "teacher absent",
        ],
        "secondary": [
            "child", "children", "learn", "read", "write",
            "pencil", "uniform", "classroom",
        ],
        "hindi": [
            "स्कूल", "शिक्षा", "छात्र", "शिक्षक", "पढ़ाई",
        ],
    },
    "Shelter": {
        "weight": 14,
        "primary": [
            "house", "shelter", "home", "homeless", "roof",
            "building", "construction", "repair", "collapsed",
            "eviction", "rent", "leaking roof", "no shelter",
            "displacement", "living on street", "temporary shelter",
        ],
        "secondary": [
            "wall", "floor", "door", "window", "room",
            "hut", "tent", "sleep",
        ],
        "hindi": [
            "घर", "मकान", "आश्रय", "बेघर", "छत",
        ],
    },
    "Infrastructure": {
        "weight": 8,
        "primary": [
            "road", "bridge", "electricity", "power cut",
            "damaged road", "pothole", "streetlight", "transformer",
            "no electricity", "power failure", "broken road",
            "no light", "cable", "wire", "pole",
        ],
        "secondary": [
            "travel", "commute", "dark", "light", "repair",
            "maintain", "facility",
        ],
        "hindi": [
            "सड़क", "बिजली", "पुल", "रोशनी",
        ],
    },
}


class CategoryDetector:
    """
    Multi-layer category detection using:
    1. Primary keyword matching (high weight)
    2. Secondary keyword matching (lower weight)
    3. Hindi keyword matching
    4. Phrase pattern matching
    5. Sentence-level context
    """

    @staticmethod
    def detect(text: str) -> Tuple[str, float, Dict[str, float]]:
        """
        Detect category with confidence score.

        Returns:
            (category, confidence, all_scores)
        """
        lower  = text.lower()
        scores = defaultdict(float)

        for category, data in CATEGORIES.items():
            # Primary keywords (full weight)
            primary_hits = sum(
                1 for word in data["primary"]
                if word in lower
            )
            scores[category] += primary_hits * data["weight"]

            # Secondary keywords (half weight)
            secondary_hits = sum(
                1 for word in data["secondary"]
                if word in lower
            )
            scores[category] += secondary_hits * (data["weight"] * 0.5)

            # Hindi keywords (full weight)
            hindi_hits = sum(
                1 for word in data.get("hindi", [])
                if word in lower
            )
            scores[category] += hindi_hits * data["weight"]

        # Normalize scores
        total = sum(scores.values())
        if total == 0:
            return "Other", 0.0, {}

        normalized = {
            cat: round(score / total, 3)
            for cat, score in scores.items()
        }

        top_cat    = max(scores, key=scores.get)
        confidence = normalized.get(top_cat, 0.0)

        return top_cat, confidence, dict(normalized)

    @staticmethod
    def get_top_categories(
        text: str,
        top_n: int = 3,
    ) -> List[Tuple[str, float]]:
        """Get top N categories with scores"""
        _, _, all_scores = CategoryDetector.detect(text)

        sorted_cats = sorted(
            all_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        return sorted_cats[:top_n]