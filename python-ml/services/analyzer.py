# import re
# import time
# import logging
# import numpy as np
# from textblob import TextBlob
# from typing import Optional, List, Tuple
# from collections import Counter

# logger = logging.getLogger(__name__)

# # ── Severity Keywords ────────────────────────────────────────
# SEVERITY_KEYWORDS = {
#     "critical": {
#         "weight": 40,
#         "words": [
#             "death", "dead", "died", "killed", "murder", "rape",
#             "sexual assault", "fire", "flood", "earthquake", "tsunami",
#             "epidemic", "outbreak", "cholera", "malaria", "dengue",
#             "covid", "pandemic", "plague", "famine", "starvation",
#             "violence", "attack", "bomb", "explosion", "riot",
#             "emergency", "critical", "disaster", "collapse",
#             "drowning", "poisoning", "toxic", "lethal",
#             "मृत्यु", "बाढ़", "आग", "महामारी", "हत्या",
#         ]
#     },
#     "high": {
#         "weight": 25,
#         "words": [
#             "injury", "injured", "hurt", "serious", "severe",
#             "hospital", "urgent", "disease", "sick", "illness",
#             "homeless", "hunger", "malnutrition", "abuse",
#             "unsafe", "contaminated", "polluted", "hazardous",
#             "broken", "collapsed", "accident", "missing",
#             "theft", "robbery", "assault", "harassment",
#             "बीमार", "भूख", "बेघर", "दुर्घटना", "हमला",
#         ]
#     },
#     "medium": {
#         "weight": 15,
#         "words": [
#             "problem", "issue", "shortage", "lack", "need",
#             "damaged", "poor", "bad", "dirty", "smell",
#             "garbage", "waste", "blocked", "closed", "delayed",
#             "complaint", "difficulty", "concern", "suffering",
#             "समस्या", "कमी", "जरूरत", "परेशानी",
#         ]
#     },
#     "low": {
#         "weight": 5,
#         "words": [
#             "suggestion", "improvement", "feedback", "request",
#             "query", "information", "update", "follow", "general",
#             "सुझाव", "जानकारी", "अनुरोध",
#         ]
#     }
# }

# # ── Categories ───────────────────────────────────────────────
# CATEGORIES = {
#     "Health": {
#         "weight": 20,
#         "words": [
#             "health", "hospital", "doctor", "medicine", "disease",
#             "sick", "patient", "medical", "clinic", "vaccine",
#             "epidemic", "fever", "malaria", "dengue", "cholera",
#             "diarrhea", "infection", "surgery", "ambulance",
#         ]
#     },
#     "Water": {
#         "weight": 18,
#         "words": [
#             "water", "drinking", "supply", "pipeline", "tap",
#             "contaminated", "dirty water", "flood", "drought",
#             "sewage", "drainage", "sanitation", "toilet",
#         ]
#     },
#     "Sanitation": {
#         "weight": 16,
#         "words": [
#             "sewage", "garbage", "waste", "sanitation", "toilet",
#             "drain", "clean", "hygiene", "dirty", "smell",
#             "open defecation", "dustbin", "litter",
#         ]
#     },
#     "Food": {
#         "weight": 16,
#         "words": [
#             "food", "hunger", "starvation", "meal", "eating",
#             "ration", "nutrition", "malnutrition", "grain",
#             "agriculture", "crop", "harvest",
#         ]
#     },
#     "Violence": {
#         "weight": 20,
#         "words": [
#             "violence", "attack", "abuse", "rape", "assault",
#             "fight", "murder", "threat", "harassment", "domestic",
#             "crime", "theft", "robbery",
#         ]
#     },
#     "Disaster": {
#         "weight": 20,
#         "words": [
#             "flood", "fire", "earthquake", "cyclone", "storm",
#             "landslide", "drought", "disaster", "emergency",
#             "relief", "rescue",
#         ]
#     },
#     "Education": {
#         "weight": 10,
#         "words": [
#             "school", "education", "student", "teacher", "class",
#             "learning", "book", "study", "literacy", "college",
#             "dropout", "fees",
#         ]
#     },
#     "Shelter": {
#         "weight": 14,
#         "words": [
#             "house", "shelter", "home", "homeless", "roof",
#             "building", "construction", "repair", "collapsed",
#             "eviction", "rent",
#         ]
#     },
#     "Infrastructure": {
#         "weight": 8,
#         "words": [
#             "road", "bridge", "electricity", "power", "light",
#             "broken", "damaged", "repair", "blocked", "pothole",
#         ]
#     },
# }

# class MLAnalyzer:

#     @staticmethod
#     def detect_category(text: str) -> Tuple[str, float]:
#         """Detect report category with confidence"""
#         lower = text.lower()
#         scores = {}

#         for category, data in CATEGORIES.items():
#             matches = sum(
#                 1 for word in data["words"]
#                 if word in lower
#             )
#             scores[category] = matches * data["weight"]

#         if not any(scores.values()):
#             return "Other", 0.0

#         top_cat   = max(scores, key=scores.get)
#         total     = sum(scores.values())
#         confidence = scores[top_cat] / total if total > 0 else 0

#         return top_cat, round(confidence, 3)

#     @staticmethod
#     def analyze_sentiment(text: str) -> Tuple[str, float]:
#         """Advanced sentiment analysis using TextBlob + keywords"""
#         blob  = TextBlob(text)
#         score = blob.sentiment.polarity
#         # -1 to 1

#         # Adjust with domain keywords
#         lower = text.lower()
#         negative_words = sum(
#             1 for w in SEVERITY_KEYWORDS["critical"]["words"]
#             if w in lower
#         )
#         negative_words += sum(
#             1 for w in SEVERITY_KEYWORDS["high"]["words"]
#             if w in lower
#         ) * 0.5

#         # More negative words push score down
#         adjusted_score = score - (negative_words * 0.1)
#         adjusted_score = max(-1.0, min(1.0, adjusted_score))

#         if adjusted_score < -0.5:   sentiment = "very_negative"
#         elif adjusted_score < -0.1: sentiment = "negative"
#         elif adjusted_score < 0.2:  sentiment = "neutral"
#         else:                       sentiment = "positive"

#         return sentiment, round(adjusted_score, 3)

#     @staticmethod
#     def extract_keywords(text: str) -> List[str]:
#         """Extract important keywords using frequency + domain matching"""
#         lower  = text.lower()
#         found  = []

#         # Domain-specific keywords (high priority)
#         for level, data in SEVERITY_KEYWORDS.items():
#             for word in data["words"]:
#                 if word in lower and word not in found:
#                     found.append(word)

#         # Also get frequent meaningful words
#         words = re.findall(r'\b[a-zA-Z]{4,}\b', text)
#         stop_words = {
#             "that", "this", "with", "have", "from", "they",
#             "will", "been", "were", "their", "also", "than",
#             "then", "some", "what", "when", "where", "which",
#         }
#         word_freq = Counter(
#             w.lower() for w in words
#             if w.lower() not in stop_words
#         )

#         # Add top frequent words
#         for word, count in word_freq.most_common(20):
#             if count >= 2 and word not in found:
#                 found.append(word)

#         return found[:10]

#     @staticmethod
#     def extract_affected_people(text: str) -> Optional[int]:
#         """Extract number of affected people from text"""
#         patterns = [
#             r'(\d+[\,\d]*)\s*(?:people|persons|families|households|villagers|residents|individuals)',
#             r'(?:affecting|affected|impacted|displaced)\s*(?:over|about|around|approximately)?\s*(\d+[\,\d]*)',
#             r'(\d+[\,\d]*)\s*(?:affected|impacted|homeless|sick|injured)',
#             r'population\s*of\s*(\d+[\,\d]*)',
#             r'(\d+[\,\d]*)\s*(?:homes|houses|children|families)',
#         ]

#         found_numbers = []
#         for pattern in patterns:
#             matches = re.findall(pattern, text, re.IGNORECASE)
#             for match in matches:
#                 num_str = match.replace(',', '')
#                 try:
#                     num = int(num_str)
#                     if 1 <= num <= 10_000_000:
#                         found_numbers.append(num)
#                 except ValueError:
#                     pass

#         if found_numbers:
#             return max(found_numbers)
#             # Return largest number found
#         return None

#     @staticmethod
#     def extract_location(text: str) -> Optional[str]:
#         """Extract location mentions from text"""
#         patterns = [
#             r'(?:in|at|near|village|district|block|area|region|zone)\s+([A-Z][a-zA-Z\s]{2,30})',
#             r'([A-Z][a-zA-Z\s]{2,20})\s+(?:district|block|village|taluka|panchayat)',
#         ]

#         locations = []
#         for pattern in patterns:
#             matches = re.findall(pattern, text)
#             locations.extend([m.strip() for m in matches if len(m.strip()) > 2])

#         return locations[0] if locations else None

#     @classmethod
#     def calculate_urgency_score(
#         cls,
#         text:           str,
#         sentiment:      str,
#         category:       str,
#         has_file:       bool,
#         affected_people: Optional[int],
#     ) -> Tuple[float, str, str]:
#         """
#         Calculate urgency score 0-100
#         Returns: (score, severity_level, explanation)
#         """
#         lower  = text.lower()
#         scores = {}
#         explanation_parts = []

#         # 1. Keyword severity (40 points max)
#         keyword_score = 0
#         for level, data in SEVERITY_KEYWORDS.items():
#             matches = [w for w in data["words"] if w in lower]
#             if matches:
#                 pts = min(data["weight"], len(matches) * (data["weight"] / 3))
#                 keyword_score = max(keyword_score, pts)
#                 explanation_parts.append(
#                     f"Found {level} keywords: {', '.join(matches[:3])}"
#                 )

#         scores["keywords"] = min(40, keyword_score)

#         # 2. Sentiment (20 points)
#         sentiment_pts = {
#             "very_negative": 20,
#             "negative":      14,
#             "neutral":       5,
#             "positive":      2,
#         }
#         scores["sentiment"] = sentiment_pts.get(sentiment, 5)
#         explanation_parts.append(f"Sentiment: {sentiment}")

#         # 3. Category weight (20 points)
#         cat_weights = {
#             "Health":         20, "Violence":  20,
#             "Disaster":       20, "Water":     18,
#             "Food":           16, "Sanitation": 16,
#             "Shelter":        14, "Education": 10,
#             "Infrastructure": 8,  "Other":      5,
#         }
#         scores["category"] = cat_weights.get(category, 5)
#         explanation_parts.append(f"Category: {category}")

#         # 4. File proof (10 points)
#         scores["file"] = 10 if has_file else 3

#         # 5. Affected people (10 points)
#         if affected_people:
#             if affected_people > 1000:  people_pts = 10
#             elif affected_people > 500: people_pts = 8
#             elif affected_people > 100: people_pts = 6
#             elif affected_people > 50:  people_pts = 4
#             else:                       people_pts = 2
#             scores["people"] = people_pts
#             explanation_parts.append(
#                 f"~{affected_people} people affected"
#             )
#         else:
#             scores["people"] = 3

#         # Total
#         total = sum(scores.values())
#         total = max(0.0, min(100.0, float(total)))

#         # Severity level
#         if total >= 80:   severity = "critical"
#         elif total >= 60: severity = "high"
#         elif total >= 40: severity = "medium"
#         elif total >= 20: severity = "low"
#         else:             severity = "info"

#         explanation = (
#             f"Score {total:.1f}/100 ({severity.upper()}). "
#             + " | ".join(explanation_parts)
#         )

#         return round(total, 1), severity, explanation

#     @classmethod
#     def analyze(
#         cls,
#         text:     str,
#         has_file: bool = False,
#     ) -> dict:
#         """Full ML analysis pipeline"""
#         start = time.time()

#         if not text or len(text.strip()) < 10:
#             return {
#                 "urgency_score":     0,
#                 "severity_level":    "info",
#                 "category":          "Other",
#                 "category_confidence": 0,
#                 "sentiment":         "neutral",
#                 "sentiment_score":   0,
#                 "keywords":          [],
#                 "affected_people":   None,
#                 "affected_area":     None,
#                 "immediate_risk":    False,
#                 "explanation":       "Insufficient text for analysis",
#                 "processing_time":   time.time() - start,
#             }

#         category, cat_confidence = cls.detect_category(text)
#         sentiment, sent_score    = cls.analyze_sentiment(text)
#         keywords                 = cls.extract_keywords(text)
#         affected_people          = cls.extract_affected_people(text)
#         affected_area            = cls.extract_location(text)

#         urgency_score, severity, explanation = cls.calculate_urgency_score(
#             text, sentiment, category, has_file, affected_people
#         )

#         immediate_risk = (
#             urgency_score >= 70 or
#             severity in ["critical", "high"] or
#             any(w in text.lower() for w in [
#                 "death", "died", "fire", "flood",
#                 "epidemic", "emergency", "rape", "murder"
#             ])
#         )

#         return {
#             "urgency_score":       urgency_score,
#             "severity_level":      severity,
#             "category":            category,
#             "category_confidence": cat_confidence,
#             "sentiment":           sentiment,
#             "sentiment_score":     sent_score,
#             "keywords":            keywords,
#             "affected_people":     affected_people,
#             "affected_area":       affected_area,
#             "immediate_risk":      immediate_risk,
#             "explanation":         explanation,
#             "processing_time":     round(time.time() - start, 3),
#         }





















# import re
# import time
# import logging
# import numpy as np
# from textblob import TextBlob
# from typing import Optional, List, Tuple
# from collections import Counter

# logger = logging.getLogger(__name__)

# # ── Negation Words ────────────────────────────────────────────
# NEGATION_WORDS = [
#     "not", "no", "never", "nobody", "nothing", "nowhere",
#     "cannot", "can't", "won't", "don't", "didn't", "doesn't",
#     "wasn't", "weren't", "haven't", "hasn't", "hadn't",
#     "without", "lack", "free from", "prevented", "avoided",
#     "hypothetical", "example", "suppose", "imagine", "if",
#     "who died", "those who", "people who", "ones who",
#     "used to", "would have", "could have", "should have",
#     "in the past", "historically", "generally", "usually",
# ]

# # ── Contextual Phrases that reduce severity ───────────────────
# FALSE_POSITIVE_PHRASES = [
#     # Hypothetical / general statements
#     "people who died",
#     "those who died",
#     "ones who died",
#     "who have died",
#     "people who are dead",
#     "dead cannot",
#     "died cannot",
#     "died can not",
#     "dead can not",
#     "if someone dies",
#     "if people die",
#     "in case of death",
#     "risk of death",           # risk mentioned, not actual
#     "fear of death",
#     "death toll unknown",

#     # Historical / educational
#     "used to die",
#     "used to died",
#     "died in the past",
#     "historically died",
#     "people used to",

#     # Metaphorical
#     "killing time",
#     "dead tired",
#     "dead end",
#     "dead serious",
#     "flooded with requests",
#     "fire sale",
#     "bombed the exam",

#     # Reported elsewhere / resolved
#     "already resolved",
#     "has been resolved",
#     "was resolved",
#     "police have arrested",
#     "situation is under control",
#     "no longer a problem",
# ]

# # ── Severity Keywords with Context Requirements ───────────────
# SEVERITY_KEYWORDS = {
#     "critical": {
#         "weight": 40,
#         "words": [
#             # Only count if NOT in false-positive context
#             "has died", "have died", "found dead", "bodies found",
#             "death confirmed", "fatality", "fatalities", "casualties",
#             "killed in", "murdered", "rape case", "raped",
#             "fire broke", "flood hit", "earthquake struck",
#             "epidemic confirmed", "outbreak reported",
#             "cholera outbreak", "dengue outbreak",
#             "starvation death", "poisoning case",
#             "building collapsed", "bridge collapsed",
#             "mass death", "multiple deaths",
#             "मृत्यु हुई", "मर गया", "मर गई",
#         ],
#         "context_required": True,
#         # Must have supporting context to count
#     },
#     "high": {
#         "weight": 25,
#         "words": [
#             "admitted to hospital", "hospitalized", "serious injury",
#             "critically injured", "severely injured", "unconscious",
#             "disease spreading", "infection spreading", "many sick",
#             "people are sick", "children are sick", "falling sick",
#             "homeless families", "displaced families", "no shelter",
#             "severe hunger", "going hungry", "no food",
#             "water contaminated", "dirty water supply",
#             "no drinking water", "water shortage",
#             "physical abuse", "domestic violence", "beaten",
#             "sexual harassment", "child abuse",
#             "toxic waste", "hazardous materials",
#             "बीमार हैं", "भूखे हैं", "बेघर हैं",
#         ],
#         "context_required": False,
#     },
#     "medium": {
#         "weight": 15,
#         "words": [
#             "roads are broken", "road is damaged",
#             "no electricity", "power cut", "frequent power cuts",
#             "garbage not collected", "waste accumulating",
#             "drainage blocked", "sewer overflow",
#             "school has no", "teacher absent",
#             "water supply irregular", "irregular supply",
#             "toilet not working", "no toilet facility",
#             "समस्या है", "परेशानी है", "दिक्कत है",
#         ],
#         "context_required": False,
#     },
#     "low": {
#         "weight": 5,
#         "words": [
#             "suggestion", "improvement needed", "feedback",
#             "requesting", "would like", "please consider",
#             "minor issue", "small problem", "slight delay",
#             "सुझाव", "अनुरोध",
#         ],
#         "context_required": False,
#     }
# }

# # ── Categories ────────────────────────────────────────────────
# CATEGORIES = {
#     "Health": {
#         "weight": 20,
#         "words": [
#             "hospital", "doctor", "medicine", "disease", "sick",
#             "patient", "medical", "clinic", "vaccine", "epidemic",
#             "fever", "malaria", "dengue", "cholera", "diarrhea",
#             "infection", "surgery", "ambulance", "health center",
#             "symptoms", "treatment", "pharmacy", "asha worker",
#         ]
#     },
#     "Water": {
#         "weight": 18,
#         "words": [
#             "drinking water", "water supply", "pipeline", "tap water",
#             "contaminated water", "dirty water", "flood water",
#             "water shortage", "no water", "borewell", "handpump",
#             "water source", "pond", "well", "water tank",
#         ]
#     },
#     "Sanitation": {
#         "weight": 16,
#         "words": [
#             "sewage", "garbage", "waste", "sanitation", "toilet",
#             "drain", "hygiene", "dirty", "smell", "stench",
#             "open defecation", "dustbin", "litter", "mosquito",
#         ]
#     },
#     "Food": {
#         "weight": 16,
#         "words": [
#             "food", "hunger", "starvation", "meal", "eating",
#             "ration", "nutrition", "malnutrition", "grain",
#             "crop", "harvest", "anganwadi", "midday meal",
#             "ration card", "pds", "food supply",
#         ]
#     },
#     "Violence": {
#         "weight": 20,
#         "words": [
#             "violence", "attack", "abuse", "assault", "fight",
#             "murder", "threat", "harassment", "domestic violence",
#             "crime", "theft", "robbery", "beating", "molest",
#         ]
#     },
#     "Disaster": {
#         "weight": 20,
#         "words": [
#             "flood", "fire", "earthquake", "cyclone", "storm",
#             "landslide", "drought", "disaster", "emergency",
#             "relief", "rescue", "natural disaster",
#         ]
#     },
#     "Education": {
#         "weight": 10,
#         "words": [
#             "school", "education", "student", "teacher", "class",
#             "learning", "literacy", "college", "dropout",
#             "fees", "scholarship", "midday meal",
#         ]
#     },
#     "Shelter": {
#         "weight": 14,
#         "words": [
#             "house", "shelter", "home", "homeless", "roof",
#             "building", "construction", "repair", "collapsed",
#             "eviction", "rent", "leaking roof",
#         ]
#     },
#     "Infrastructure": {
#         "weight": 8,
#         "words": [
#             "road", "bridge", "electricity", "power", "light",
#             "damaged road", "pothole", "streetlight", "transformer",
#         ]
#     },
# }

# # ── Context Multipliers ───────────────────────────────────────
# CONTEXT_MULTIPLIERS = {
#     "children":  1.3,
#     "women":     1.2,
#     "elderly":   1.2,
#     "pregnant":  1.3,
#     "disabled":  1.2,
#     "remote":    1.1,
#     "recurring": 1.1,
#     "resolved":  0.5,
#     "already fixed": 0.4,
# }


# class MLAnalyzer:

#     @staticmethod
#     def get_sentences(text: str) -> List[str]:
#         """Split text into sentences"""
#         sentences = re.split(r'[.!?\n]', text)
#         return [s.strip() for s in sentences if len(s.strip()) > 5]

#     @staticmethod
#     def is_false_positive(sentence: str, keyword: str) -> bool:
#         """
#         Check if keyword match is a false positive.
#         Returns True if it should NOT be counted as severe.
#         """
#         lower = sentence.lower()

#         # Check false positive phrases
#         for phrase in FALSE_POSITIVE_PHRASES:
#             if phrase in lower:
#                 return True

#         # Check negation within 5 words before keyword
#         keyword_pos = lower.find(keyword)
#         if keyword_pos == -1:
#             return False

#         # Get 40 chars before the keyword
#         context_before = lower[max(0, keyword_pos - 40):keyword_pos]

#         for neg in NEGATION_WORDS:
#             if neg in context_before:
#                 return True

#         return False

#     @staticmethod
#     def check_keyword_in_context(
#         text: str,
#         keyword: str,
#         context_required: bool,
#     ) -> bool:
#         """
#         Check if keyword appears in a meaningful context.
#         Returns True if keyword should be counted.
#         """
#         lower     = text.lower()
#         sentences = MLAnalyzer.get_sentences(text)

#         if keyword not in lower:
#             return False

#         # Find which sentences contain the keyword
#         for sentence in sentences:
#             if keyword in sentence.lower():
#                 # Check if it's a false positive
#                 if MLAnalyzer.is_false_positive(sentence, keyword):
#                     logger.debug(f"False positive: '{keyword}' in '{sentence[:60]}'")
#                     continue

#                 # If context required, check for supporting context
#                 if context_required:
#                     s_lower = sentence.lower()
#                     # Must have location/time/evidence context
#                     context_indicators = [
#                         "today", "yesterday", "this morning", "last night",
#                         "reported", "found", "confirmed", "witnessed",
#                         "in our area", "in the village", "near",
#                         "at least", "approximately", "around",
#                     ]
#                     has_context = any(ind in s_lower for ind in context_indicators)
#                     if has_context:
#                         return True
#                 else:
#                     return True

#         return False

#     @staticmethod
#     def detect_category(text: str) -> Tuple[str, float]:
#         """Detect report category"""
#         lower  = text.lower()
#         scores = {}

#         for category, data in CATEGORIES.items():
#             matches = sum(1 for word in data["words"] if word in lower)
#             scores[category] = matches * data["weight"]

#         if not any(scores.values()):
#             return "Other", 0.0

#         top_cat    = max(scores, key=scores.get)
#         total      = sum(scores.values())
#         confidence = scores[top_cat] / total if total > 0 else 0

#         return top_cat, round(confidence, 3)

#     @staticmethod
#     def analyze_sentiment(text: str) -> Tuple[str, float]:
#         """Sentiment analysis with context awareness"""
#         blob  = TextBlob(text)
#         score = blob.sentiment.polarity

#         lower = text.lower()

#         # Only adjust sentiment if keywords are NOT false positives
#         critical_hits = 0
#         for word in SEVERITY_KEYWORDS["critical"]["words"]:
#             if MLAnalyzer.check_keyword_in_context(text, word, True):
#                 critical_hits += 1

#         high_hits = 0
#         for word in SEVERITY_KEYWORDS["high"]["words"]:
#             if MLAnalyzer.check_keyword_in_context(text, word, False):
#                 high_hits += 1

#         adjusted = score - (critical_hits * 0.15) - (high_hits * 0.08)
#         adjusted = max(-1.0, min(1.0, adjusted))

#         if adjusted < -0.5:   sentiment = "very_negative"
#         elif adjusted < -0.1: sentiment = "negative"
#         elif adjusted < 0.2:  sentiment = "neutral"
#         else:                 sentiment = "positive"

#         return sentiment, round(adjusted, 3)

#     @staticmethod
#     def extract_keywords(text: str) -> List[str]:
#         """Extract meaningful keywords (context-aware)"""
#         found = []

#         # Only add severity keywords that pass context check
#         for level, data in SEVERITY_KEYWORDS.items():
#             for word in data["words"]:
#                 if (word not in found and
#                     MLAnalyzer.check_keyword_in_context(
#                         text, word, data["context_required"]
#                     )):
#                     found.append(word)

#         # Add frequent meaningful words
#         words     = re.findall(r'\b[a-zA-Z]{4,}\b', text)
#         stop_words = {
#             "that", "this", "with", "have", "from", "they", "will",
#             "been", "were", "their", "also", "than", "then", "some",
#             "what", "when", "where", "which", "very", "just", "more",
#             "into", "over", "after", "people", "those", "about",
#         }
#         word_freq = Counter(
#             w.lower() for w in words if w.lower() not in stop_words
#         )
#         for word, count in word_freq.most_common(20):
#             if count >= 2 and word not in found:
#                 found.append(word)

#         return found[:10]

#     @staticmethod
#     def extract_affected_people(text: str) -> Optional[int]:
#         """Extract number of affected people"""
#         patterns = [
#             r'(\d+[\,\d]*)\s*(?:people|persons|families|households|villagers|residents|individuals)\s*(?:are|were|have been)?\s*(?:affected|sick|injured|homeless|displaced)',
#             r'(?:affecting|affected|impacted|displaced)\s*(?:over|about|around|approximately)?\s*(\d+[\,\d]*)',
#             r'(\d+[\,\d]*)\s*(?:homes|houses|children|families)\s*(?:are|were|have)?\s*(?:affected|damaged|destroyed)',
#             r'population\s*of\s*(?:about|around|over)?\s*(\d+[\,\d]*)',
#             r'over\s+(\d+[\,\d]*)\s+(?:people|families|persons)',
#             r'more\s+than\s+(\d+[\,\d]*)\s+(?:people|families)',
#             r'at\s+least\s+(\d+[\,\d]*)\s+(?:people|persons|families)',
#         ]

#         found = []
#         for pattern in patterns:
#             for match in re.findall(pattern, text, re.IGNORECASE):
#                 try:
#                     num = int(str(match).replace(',', ''))
#                     if 1 <= num <= 10_000_000:
#                         found.append(num)
#                 except ValueError:
#                     pass

#         return max(found) if found else None

#     @staticmethod
#     def extract_location(text: str) -> Optional[str]:
#         """Extract location from text"""
#         patterns = [
#             r'(?:in|at|near|village|district|block|area|region|zone)\s+([A-Z][a-zA-Z\s]{2,25})',
#             r'([A-Z][a-zA-Z\s]{2,20})\s+(?:district|block|village|taluka|panchayat|ward)',
#         ]
#         locations = []
#         for pattern in patterns:
#             for m in re.findall(pattern, text):
#                 loc = m.strip()
#                 if len(loc) > 2:
#                     locations.append(loc)
#         return locations[0] if locations else None

#     @staticmethod
#     def detect_context_multiplier(text: str) -> Tuple[float, List[str]]:
#         """Context multiplier for vulnerable groups"""
#         lower      = text.lower()
#         multiplier = 1.0
#         reasons    = []

#         for context, mult in CONTEXT_MULTIPLIERS.items():
#             if context in lower:
#                 multiplier *= mult
#                 if mult > 1.0:
#                     reasons.append(f"involves {context}")
#                 else:
#                     reasons.append(f"situation is {context}")

#         return round(min(multiplier, 1.5), 3), reasons

#     @classmethod
#     def calculate_urgency_score(
#         cls,
#         text:            str,
#         sentiment:       str,
#         category:        str,
#         has_file:        bool,
#         affected_people: Optional[int],
#         multiplier:      float = 1.0,
#     ) -> Tuple[float, str, str]:
#         """Calculate urgency score with context-aware keyword matching"""
#         scores = {}
#         explanation_parts = []

#         # 1. Context-aware keyword scoring (40 pts max)
#         keyword_score = 0
#         matched_keywords = []

#         for level, data in SEVERITY_KEYWORDS.items():
#             level_matches = []
#             for word in data["words"]:
#                 if cls.check_keyword_in_context(
#                     text, word, data["context_required"]
#                 ):
#                     level_matches.append(word)

#             if level_matches:
#                 pts = min(
#                     data["weight"],
#                     len(level_matches) * (data["weight"] / 3)
#                 )
#                 keyword_score    = max(keyword_score, pts)
#                 matched_keywords.extend(level_matches[:2])
#                 explanation_parts.append(
#                     f"{level} indicators: {', '.join(level_matches[:3])}"
#                 )

#         scores["keywords"] = min(40, keyword_score)

#         # 2. Sentiment (20 pts)
#         sentiment_pts = {
#             "very_negative": 20,
#             "negative":      14,
#             "neutral":       5,
#             "positive":      2,
#         }
#         scores["sentiment"] = sentiment_pts.get(sentiment, 5)

#         # 3. Category (20 pts)
#         cat_weights = {
#             "Health": 20, "Violence": 20, "Disaster": 20,
#             "Water": 18, "Food": 16, "Sanitation": 16,
#             "Shelter": 14, "Education": 10,
#             "Infrastructure": 8, "Other": 5,
#         }
#         scores["category"] = cat_weights.get(category, 5)

#         # 4. Evidence file (10 pts)
#         scores["file"] = 10 if has_file else 3

#         # 5. Affected people (10 pts)
#         if affected_people:
#             if affected_people > 1000:  scores["people"] = 10
#             elif affected_people > 500: scores["people"] = 8
#             elif affected_people > 100: scores["people"] = 6
#             elif affected_people > 50:  scores["people"] = 4
#             else:                       scores["people"] = 2
#             explanation_parts.append(f"~{affected_people} people affected")
#         else:
#             scores["people"] = 3

#         # Apply multiplier
#         total = sum(scores.values()) * multiplier
#         total = round(max(0.0, min(100.0, float(total))), 1)

#         if total >= 80:   severity = "critical"
#         elif total >= 60: severity = "high"
#         elif total >= 40: severity = "medium"
#         elif total >= 20: severity = "low"
#         else:             severity = "info"

#         explanation = (
#             f"Score {total}/100 ({severity.upper()}). "
#             + " | ".join(explanation_parts)
#             if explanation_parts
#             else f"Score {total}/100 ({severity.upper()}). General report."
#         )

#         return total, severity, explanation

#     @staticmethod
#     def generate_summary(
#         text: str,
#         category: str,
#         severity: str,
#         urgency_score: float,
#         keywords: List[str],
#         affected_people: Optional[int],
#         affected_area: Optional[str],
#         immediate_risk: bool,
#     ) -> Tuple[str, str]:
#         """Generate ML-based summary from actual report content"""

#         sentences = [
#             s.strip() for s in re.split(r'[.!?\n]', text)
#             if len(s.strip()) > 20
#         ]

#         severity_label = {
#             "critical": "CRITICAL",
#             "high":     "HIGH URGENCY",
#             "medium":   "MODERATE",
#             "low":      "LOW URGENCY",
#             "info":     "INFORMATIONAL",
#         }.get(severity, "UNKNOWN")

#         people_str = f" affecting ~{affected_people} people" if affected_people else ""
#         area_str   = f" in {affected_area}" if affected_area else ""
#         risk_str   = " Immediate action required." if immediate_risk else ""

#         # Short summary
#         summary = (
#             f"[{severity_label}] {category} issue reported{area_str}{people_str}. "
#             f"Score: {urgency_score}/100.{risk_str} "
#             f"Key concerns: {', '.join(keywords[:4]) if keywords else 'see report'}."
#         )

#         # Score sentences by relevance to severity keywords
#         scored_sentences = []
#         for sent in sentences[:20]:
#             score   = 0
#             s_lower = sent.lower()

#             for level, data in SEVERITY_KEYWORDS.items():
#                 for word in data["words"]:
#                     if word in s_lower:
#                         # Only score if NOT a false positive
#                         if not MLAnalyzer.is_false_positive(sent, word):
#                             score += SEVERITY_KEYWORDS[level]["weight"]

#             scored_sentences.append((score, sent))

#         scored_sentences.sort(reverse=True)
#         top_sentences = [s[1] for s in scored_sentences[:4] if s[0] > 0]

#         if top_sentences:
#             extracted = ". ".join(top_sentences)
#             detailed = (
#                 f"This is a {severity} severity {category.lower()} report{area_str}. "
#                 f"ML analysis assigned urgency score {urgency_score}/100 based on "
#                 f"context-aware keyword analysis, sentiment detection, and impact assessment. "
#                 f"Key report content: {extracted[:500]}. "
#                 f"{'Immediate action is strongly recommended.' if immediate_risk else 'Timely intervention advised.'}"
#             )
#         else:
#             detailed = (
#                 f"This {category.lower()} report has been assessed at {severity} severity "
#                 f"(score: {urgency_score}/100). "
#                 f"Detected indicators: {', '.join(keywords[:6]) if keywords else 'general concerns'}. "
#                 f"{'Please escalate immediately.' if immediate_risk else 'Please review the full report.'}"
#             )

#         return summary[:400], detailed[:800]

#     @staticmethod
#     def generate_key_problems(
#         text: str,
#         keywords: List[str],
#         category: str,
#         severity: str,
#     ) -> List[str]:
#         """Extract key problems from actual report sentences"""
#         problems  = []
#         sentences = [
#             s.strip() for s in re.split(r'[.!?\n]', text)
#             if len(s.strip()) > 15
#         ]

#         for sent in sentences:
#             s_lower = sent.lower()
#             for level in ["critical", "high", "medium"]:
#                 matched = False
#                 for word in SEVERITY_KEYWORDS[level]["words"]:
#                     if word in s_lower:
#                         # Only add if NOT a false positive
#                         if not MLAnalyzer.is_false_positive(sent, word):
#                             clean = sent.strip()
#                             if (len(clean) > 10 and
#                                 len(clean) < 200 and
#                                 clean not in problems):
#                                 problems.append(clean)
#                             matched = True
#                             break
#                 if matched:
#                     break

#         # Fallback
#         if not problems and keywords:
#             for kw in keywords[:4]:
#                 problems.append(f"Concern identified: {kw}")

#         return problems[:5]

#     @staticmethod
#     def generate_suggested_actions(
#         severity: str,
#         category: str,
#         immediate: bool,
#         keywords: List[str],
#     ) -> List[str]:
#         """Generate actions based on severity and category"""

#         category_actions = {
#             "Health": [
#                 "Deploy medical team for assessment within 24 hours",
#                 "Arrange medicines and first aid supplies",
#                 "Coordinate with nearest PHC/CHC",
#                 "Monitor and report new cases daily",
#             ],
#             "Water": [
#                 "Arrange alternative clean water supply immediately",
#                 "Test water quality and identify contamination source",
#                 "Repair water source/pipeline within 48 hours",
#                 "Distribute water purification tablets",
#             ],
#             "Sanitation": [
#                 "Arrange immediate waste collection",
#                 "Deploy sanitation workers",
#                 "Install temporary toilet if needed",
#                 "Conduct hygiene awareness session",
#             ],
#             "Food": [
#                 "Arrange emergency food distribution",
#                 "Verify ration card status for affected families",
#                 "Contact PDS center for emergency supplies",
#                 "Assess children under 5 for malnutrition",
#             ],
#             "Violence": [
#                 "Report to local police immediately",
#                 "Ensure safety of victims",
#                 "Provide legal aid and counseling",
#                 "Coordinate with women/child protection officers",
#             ],
#             "Disaster": [
#                 "Activate emergency response immediately",
#                 "Evacuate affected people to safety",
#                 "Coordinate with NDRF/SDRF",
#                 "Arrange relief — food, water, shelter",
#             ],
#             "Education": [
#                 "Report to Block Education Officer",
#                 "Arrange temporary learning space",
#                 "Address dropout risk through counseling",
#                 "Follow up with school management",
#             ],
#             "Shelter": [
#                 "Arrange temporary shelter for displaced families",
#                 "Assess structural damage",
#                 "Apply for government housing scheme",
#                 "Provide emergency repair materials",
#             ],
#             "Infrastructure": [
#                 "Report to gram panchayat/municipal authority",
#                 "Arrange temporary fix within 48 hours",
#                 "Submit formal complaint with photos",
#                 "Follow up with PWD/electricity department",
#             ],
#         }

#         severity_actions = {
#             "critical": [
#                 "⚠️ SEND THIS REPORT TO COMMITTEE IMMEDIATELY",
#                 "Alert senior NGO management within 1 hour",
#             ],
#             "high": [
#                 "Send report to committee within 24 hours",
#                 "Escalate to zone coordinator",
#             ],
#             "medium": [
#                 "Submit for committee review this week",
#                 "Document with photos for stronger case",
#             ],
#             "low": [
#                 "Include in weekly report to committee",
#                 "Monitor for any escalation",
#             ],
#             "info": [
#                 "File for records and periodic review",
#                 "No immediate action required",
#             ],
#         }

#         actions  = severity_actions.get(severity, [])
#         actions += category_actions.get(category, [
#             "Document issue with photos",
#             "Report to relevant local authority",
#             "Follow up within one week",
#         ])

#         return actions[:5]

#     @classmethod
#     def analyze(cls, text: str, has_file: bool = False) -> dict:
#         """Full context-aware ML analysis pipeline"""
#         start = time.time()

#         if not text or len(text.strip()) < 10:
#             return {
#                 "urgency_score":       0,
#                 "severity_level":      "info",
#                 "category":            "Other",
#                 "category_confidence": 0,
#                 "sentiment":           "neutral",
#                 "sentiment_score":     0,
#                 "summary":             "Insufficient text for analysis",
#                 "detailed_analysis":   "",
#                 "key_problems":        [],
#                 "suggested_actions":   ["Submit a more detailed report"],
#                 "keywords":            [],
#                 "affected_people":     None,
#                 "affected_area":       None,
#                 "immediate_risk":      False,
#                 "confidence_score":    0.0,
#                 "explanation":         "Text too short",
#                 "processing_time":     round(time.time() - start, 3),
#                 "model_used":          "ml-pipeline-v2",
#             }

#         # Run ML pipeline
#         category, cat_conf    = cls.detect_category(text)
#         sentiment, sent_score = cls.analyze_sentiment(text)
#         keywords              = cls.extract_keywords(text)
#         affected_people       = cls.extract_affected_people(text)
#         affected_area         = cls.extract_location(text)
#         multiplier, ctx_notes = cls.detect_context_multiplier(text)

#         urgency_score, severity, explanation = cls.calculate_urgency_score(
#             text, sentiment, category,
#             has_file, affected_people, multiplier,
#         )

#         # Immediate risk only if real critical keywords found in context
#         critical_confirmed = any(
#             cls.check_keyword_in_context(text, w, True)
#             for w in SEVERITY_KEYWORDS["critical"]["words"]
#         )

#         immediate_risk = (
#             urgency_score >= 75 or
#             (urgency_score >= 60 and critical_confirmed) or
#             severity == "critical"
#         )

#         summary, detailed = cls.generate_summary(
#             text, category, severity, urgency_score,
#             keywords, affected_people, affected_area, immediate_risk,
#         )

#         key_problems = cls.generate_key_problems(
#             text, keywords, category, severity
#         )

#         suggested_actions = cls.generate_suggested_actions(
#             severity, category, immediate_risk, keywords
#         )

#         logger.info(
#             f"✅ ML Analysis done | Score: {urgency_score} | "
#             f"Severity: {severity} | Category: {category} | "
#             f"ImmediateRisk: {immediate_risk}"
#         )

#         return {
#             "urgency_score":       urgency_score,
#             "severity_level":      severity,
#             "category":            category,
#             "category_confidence": cat_conf,
#             "sentiment":           sentiment,
#             "sentiment_score":     sent_score,
#             "summary":             summary,
#             "detailed_analysis":   detailed,
#             "key_problems":        key_problems,
#             "suggested_actions":   suggested_actions,
#             "keywords":            keywords,
#             "affected_people":     affected_people,
#             "affected_area":       affected_area,
#             "immediate_risk":      immediate_risk,
#             "confidence_score":    round(min(0.95, cat_conf + 0.3), 2),
#             "explanation":         explanation,
#             "processing_time":     round(time.time() - start, 3),
#             "model_used":          "ml-pipeline-v2-context-aware",
#         }






















import re
import time
import logging
from typing import Optional, List

from .ml import (
    ContextChecker,
    UrgencyScorer,
    CategoryDetector,
    SentimentAnalyzer,
    EntityExtractor,
    TextSummarizer,
    ActionGenerator,
)

logger = logging.getLogger(__name__)


class MLAnalyzer:
    """
    Main ML analysis orchestrator.
    Coordinates all ML sub-modules for accurate report analysis.
    """

    @classmethod
    def extract_keywords(cls, text: str, matched: List[str]) -> List[str]:
        """Get final keyword list combining matched + frequent words"""
        import re
        from collections import Counter

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
                "model_used":          "ml-pipeline-v3",
            }

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
        score, severity, explanation, matched_kw = UrgencyScorer.calculate(
            text=text,
            sentiment=sentiment,
            category=category,
            has_file=has_file,
            affected_people=affected_people,
            indicators=indicators,
        )
        logger.info(f"Score: {score} | Severity: {severity}")

        # ── Step 5: Keyword Extraction ────────────────────────
        keywords = cls.extract_keywords(text, matched_kw)

        # ── Step 6: Immediate Risk Detection ─────────────────
        critical_confirmed = any(
            ContextChecker.verify_keyword(text, w, True)[0]
            for w in [
                "has died", "have died", "found dead", "fatality",
                "fatalities", "building collapsed", "epidemic confirmed",
            ]
        )

        immediate_risk = (
            score >= 75 or
            (score >= 60 and critical_confirmed) or
            severity == "critical" or
            indicators.get("has_deaths", False) or
            indicators.get("has_disease", False) and score >= 55
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
            "model_used":          "ml-pipeline-v3-modular",
        }