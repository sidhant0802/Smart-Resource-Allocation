import re
import logging
from typing import Tuple, Dict, List
from collections import defaultdict

logger = logging.getLogger(__name__)

CATEGORIES: Dict[str, Dict] = {
    "Health": {
        "weight": 20,
        "primary": [
            "hospital", "doctor", "medicine", "disease", "sick",
            "patient", "medical", "clinic", "vaccine", "epidemic",
            "fever", "malaria", "dengue", "cholera", "diarrhea",
            "infection", "surgery", "ambulance", "health center",
            "symptoms", "treatment", "pharmacy", "asha worker",
            "health camp", "blood", "vomiting", "rash", "typhoid",
            "tuberculosis", "tb", "hiv", "aids", "cancer", "diabetes",
            "anemia", "malnourished", "malnutrition", "stunting",
            "maternal", "infant mortality", "neonatal", "pneumonia",
            "respiratory", "breathing difficulty", "unconscious",
            "paralysis", "seizure", "epilepsy",
        ],
        "secondary": [
            "pain", "weak", "ill", "care", "nurse", "bed",
            "ward", "icu", "injection", "tablet", "capsule",
            "health", "cure", "heal", "recover", "dying",
        ],
        "hindi": [
            "बीमार", "दवाई", "अस्पताल", "डॉक्टर", "बुखार",
            "बीमारी", "इलाज", "स्वास्थ्य", "दर्द", "उल्टी",
            "दस्त", "मलेरिया", "डेंगू", "टीबी",
        ],
    },
    "Water": {
        "weight": 18,
        "primary": [
            "drinking water", "water supply", "pipeline", "tap water",
            "contaminated water", "dirty water", "water shortage",
            "no water", "borewell", "handpump", "water source",
            "pond", "well", "water tank", "water pump", "tube well",
            "water crisis", "water problem", "sewage mixing",
            "water borne", "waterborne", "fluoride", "arsenic water",
        ],
        "secondary": [
            "thirsty", "dehydrated", "water", "liquid", "fluid",
            "rain water", "ground water", "tap", "pipe",
        ],
        "hindi": [
            "पानी", "पीने का पानी", "जल", "नल", "पानी की समस्या",
            "गंदा पानी", "पानी नहीं", "जलसंकट",
        ],
    },
    "Sanitation": {
        "weight": 16,
        "primary": [
            "sewage", "garbage", "waste", "sanitation", "toilet",
            "drain", "hygiene", "dirty", "smell", "stench",
            "open defecation", "dustbin", "litter", "mosquito",
            "rats", "rodent", "pest", "drainage blocked",
            "garbage dump", "waste disposal", "swachh bharat",
            "open drain", "nali", "fly breeding", "malaria mosquito",
        ],
        "secondary": [
            "clean", "cleanliness", "filth", "mud", "sewer",
            "latrine", "bathroom", "flush", "loo",
        ],
        "hindi": [
            "गंदगी", "सफाई", "शौचालय", "नाली", "कचरा",
            "बदबू", "मच्छर", "चूहे", "नाला",
        ],
    },
    "Food": {
        "weight": 16,
        "primary": [
            "food", "hunger", "starvation", "meal", "eating",
            "ration", "nutrition", "malnutrition", "grain",
            "crop", "harvest", "anganwadi", "midday meal",
            "ration card", "pds", "food supply", "food shortage",
            "no food", "starving", "famine", "food poisoning",
            "pm poshan", "mdm", "bpl", "food security",
        ],
        "secondary": [
            "eat", "hungry", "feed", "cook", "kitchen",
            "rice", "wheat", "dal", "vegetable", "salt",
        ],
        "hindi": [
            "भोजन", "भूख", "राशन", "खाना", "अनाज",
            "भूखे", "राशन कार्ड", "अनाज नहीं", "खाद्य संकट",
        ],
    },
    "Violence": {
        "weight": 20,
        "primary": [
            "violence", "attack", "abuse", "assault", "fight",
            "murder", "threat", "harassment", "domestic violence",
            "crime", "theft", "robbery", "beating", "molest",
            "rape", "sexual assault", "kidnap", "missing person",
            "physical abuse", "child abuse", "mob", "riot",
            "lynching", "acid attack", "eve teasing", "dowry",
            "human trafficking", "bonded labour", "child marriage",
        ],
        "secondary": [
            "hit", "hurt", "beat", "punch", "wound",
            "weapon", "knife", "gun", "lathi", "brick",
        ],
        "hindi": [
            "हिंसा", "मारपीट", "बलात्कार", "चोरी", "हमला",
            "दहेज", "बाल विवाह", "अपहरण", "धमकी",
        ],
    },
    "Disaster": {
        "weight": 20,
        "primary": [
            "flood", "fire", "earthquake", "cyclone", "storm",
            "landslide", "drought", "disaster", "emergency",
            "relief", "rescue", "natural disaster", "tornado",
            "lightning strike", "building collapse", "dam break",
            "cloud burst", "heavy rain damage", "tsunami",
            "heatwave", "cold wave", "crop damage", "locust",
        ],
        "secondary": [
            "destroyed", "damage", "collapse", "swept",
            "trapped", "buried", "rescue team", "ndrf",
        ],
        "hindi": [
            "बाढ़", "आग", "भूकंप", "तूफान", "सूखा",
            "बादल फटना", "भूस्खलन", "राहत", "बचाव",
        ],
    },
    "Education": {
        "weight": 10,
        "primary": [
            "school", "education", "student", "teacher", "class",
            "learning", "literacy", "college", "dropout",
            "fees", "scholarship", "midday meal", "books",
            "study", "exam", "school building", "teacher absent",
            "anganwadi", "pre-school", "rte", "right to education",
            "out of school", "child labour", "beo", "education officer",
        ],
        "secondary": [
            "child", "children", "learn", "read", "write",
            "pencil", "uniform", "classroom", "chalk", "board",
        ],
        "hindi": [
            "स्कूल", "शिक्षा", "छात्र", "शिक्षक", "पढ़ाई",
            "बच्चे", "शिक्षक अनुपस्थित", "मिड डे मील",
        ],
    },
    "Shelter": {
        "weight": 14,
        "primary": [
            "house", "shelter", "home", "homeless", "roof",
            "building", "construction", "repair", "collapsed",
            "eviction", "rent", "leaking roof", "no shelter",
            "displacement", "living on street", "temporary shelter",
            "pm awas", "pmay", "housing scheme", "kutcha house",
            "jhuggi", "slum", "tent", "tarpaulin",
        ],
        "secondary": [
            "wall", "floor", "door", "window", "room",
            "hut", "tent", "sleep", "rain coming in",
        ],
        "hindi": [
            "घर", "मकान", "आश्रय", "बेघर", "छत",
            "कच्चा घर", "टूटा घर", "बेघर", "किराया",
        ],
    },
    "Infrastructure": {
        "weight": 8,
        "primary": [
            "road", "bridge", "electricity", "power cut",
            "damaged road", "pothole", "streetlight", "transformer",
            "no electricity", "power failure", "broken road",
            "no light", "cable", "wire", "pole",
            "mobile network", "no signal", "internet down",
            "water pipeline burst", "sewage pipeline",
        ],
        "secondary": [
            "travel", "commute", "dark", "light", "repair",
            "maintain", "facility", "connection",
        ],
        "hindi": [
            "सड़क", "बिजली", "पुल", "रोशनी", "खड्डा",
            "अंधेरा", "बिजली गई", "सड़क टूटी",
        ],
    },
}


class CategoryDetector:

    @staticmethod
    def detect(text: str) -> Tuple[str, float, Dict[str, float]]:
        lower = text.lower()
        scores = defaultdict(float)

        for category, data in CATEGORIES.items():
            primary_hits = sum(1 for word in data["primary"] if word in lower)
            scores[category] += primary_hits * data["weight"]

            secondary_hits = sum(1 for word in data["secondary"] if word in lower)
            scores[category] += secondary_hits * (data["weight"] * 0.5)

            hindi_hits = sum(1 for word in data.get("hindi", []) if word in lower)
            scores[category] += hindi_hits * data["weight"]

        total = sum(scores.values())
        if total == 0:
            return "Other", 0.0, {}

        normalized = {
            cat: round(score / total, 3)
            for cat, score in scores.items()
        }

        top_cat = max(scores, key=scores.get)
        confidence = normalized.get(top_cat, 0.0)

        return top_cat, confidence, dict(normalized)

    @staticmethod
    def get_top_categories(text: str, top_n: int = 3) -> List[Tuple[str, float]]:
        _, _, all_scores = CategoryDetector.detect(text)
        sorted_cats = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_cats[:top_n]