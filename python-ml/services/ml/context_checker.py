# ml/context_checker.py
import re
import logging
from typing import Tuple, Dict, List, Optional
from collections import defaultdict
import spacy

logger = logging.getLogger(__name__)

# Load spaCy for advanced NLP (install: python -m spacy download en_core_web_sm)
try:
    nlp = spacy.load("en_core_web_sm")
    HAS_SPACY = True
except:
    HAS_SPACY = False
    logger.warning("spaCy not available - using basic NLP")

# ── Enhanced False Positive Detection ────────────────────────
FALSE_POSITIVE_PATTERNS = {
    "general_truth": [
        r'\b(everyone|all people|humans?|we all)\s+(will\s+)?(die|dies|pass away)',
        r'\b(death|dying)\s+is\s+(inevitable|natural|certain|part of life)',
        r'\b(people|those|ones)\s+who\s+(die|died|have died|will die)',
        r'\b(when|if|after)\s+(people|someone|anyone)\s+(die|dies)',
    ],
    "hypothetical": [
        r'\b(if|suppose|imagine|what if|in case)\b',
        r'\b(could|would|should|might|may)\s+(have\s+)?(die|happen)',
        r'\b(hypothetically|theoretically|potentially)\b',
    ],
    "resolved": [
        r'\b(already|has been|was)\s+(resolved|fixed|controlled|stopped)',
        r'\b(no longer|not anymore)\s+a\s+(problem|issue|concern)',
        r'\b(situation\s+under\s+control|under\s+control)\b',
    ],
    "hearsay": [
        r'\b(i\s+heard|they\s+say|people\s+say|rumor|allegedly)\b',
        r'\b(according\s+to\s+rumor|someone\s+told\s+me)\b',
    ],
    "metaphorical": [
        r'\b(dying\s+to|to\s+die\s+for|kill\s+time|dead\s+tired)\b',
        r'\b(viral\s+content|explosive\s+growth|fire\s+sale)\b',
    ],
}

# ── Evidence Indicators ───────────────────────────────────────
STRONG_EVIDENCE = {
    "temporal": [
        r'\b(today|yesterday|this\s+morning|last\s+night)\b',
        r'\b(this\s+week|last\s+week|just\s+now|currently)\b',
        r'\b(\d+)\s+(hours?|days?)\s+ago\b',
        r'\bon\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',
    ],
    "reporting": [
        r'\b(reported|confirmed|verified|witnessed|documented)\b',
        r'\b(we\s+saw|i\s+saw|we\s+found|discovered)\b',
        r'\b(diagnosed|detected|identified|recorded)\b',
        r'\b(police\s+report|fir\s+filed|complaint\s+filed)\b',
    ],
    "location_specific": [
        r'\b(in\s+our|at\s+our|near\s+our)\s+(area|village|ward|colony)\b',
        r'\b(here\s+in|at\s+this|in\s+this)\s+(location|place|area)\b',
        r'\bat\s+[A-Z][a-zA-Z]+\s+(village|ward|area|block)\b',
    ],
    "quantitative": [
        r'\b(exactly|approximately|around|over|at\s+least)\s+\d+\b',
        r'\b\d+\s+(people|persons|families|children|patients)\b',
    ],
}

# ── Negation Detection ────────────────────────────────────────
NEGATION_INDICATORS = {
    "direct": ["not", "no", "never", "nobody", "nothing", "nowhere", "neither", "nor"],
    "contractions": ["can't", "won't", "don't", "didn't", "doesn't", "wasn't", "weren't", "haven't", "hasn't", "hadn't"],
    "prevention": ["prevented", "avoided", "stopped", "controlled", "contained", "managed"],
    "absence": ["without", "lacking", "missing", "absent", "free from"],
}

class AdvancedContextChecker:
    """
    Advanced context verification using:
    - Dependency parsing (spaCy)
    - Temporal analysis
    - Named Entity Recognition
    - Semantic similarity
    - Multi-sentence context
    """

    @staticmethod
    def get_sentences(text: str) -> List[str]:
        """Smart sentence splitting"""
        if HAS_SPACY:
            doc = nlp(text)
            return [sent.text.strip() for sent in doc.sents]
        else:
            # Fallback regex
            raw = re.split(r'[.!?\n]+', text)
            return [s.strip() for s in raw if len(s.strip()) > 5]

    @staticmethod
    def extract_temporal_markers(sentence: str) -> List[str]:
        """Extract time references indicating when event occurred"""
        markers = []
        for pattern in STRONG_EVIDENCE["temporal"]:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            markers.extend(matches if isinstance(matches, list) else [matches])
        return markers

    @staticmethod
    def has_reporting_verb(sentence: str) -> bool:
        """Check if sentence contains reporting/confirmation verbs"""
        for pattern in STRONG_EVIDENCE["reporting"]:
            if re.search(pattern, sentence, re.IGNORECASE):
                return True
        return False

    @staticmethod
    def has_specific_location(sentence: str) -> bool:
        """Check for specific location mention"""
        for pattern in STRONG_EVIDENCE["location_specific"]:
            if re.search(pattern, sentence, re.IGNORECASE):
                return True
        return False

    @staticmethod
    def has_quantitative_data(sentence: str) -> bool:
        """Check for specific numbers/quantities"""
        for pattern in STRONG_EVIDENCE["quantitative"]:
            if re.search(pattern, sentence, re.IGNORECASE):
                return True
        return False

    @classmethod
    def calculate_evidence_score(cls, sentence: str) -> float:
        """
        Calculate evidence strength score (0.0 - 1.0)
        Higher score = stronger evidence of real incident
        """
        score = 0.0

        # Temporal markers (+0.3)
        if cls.extract_temporal_markers(sentence):
            score += 0.3

        # Reporting verbs (+0.25)
        if cls.has_reporting_verb(sentence):
            score += 0.25

        # Specific location (+0.2)
        if cls.has_specific_location(sentence):
            score += 0.2

        # Quantitative data (+0.25)
        if cls.has_quantitative_data(sentence):
            score += 0.25

        return min(1.0, score)

    @classmethod
    def is_false_positive(cls, sentence: str, keyword: str) -> Tuple[bool, str]:
        """
        Comprehensive false positive detection.
        Returns (is_false_positive, reason)
        """
        lower = sentence.lower()

        # Check all false positive patterns
        for category, patterns in FALSE_POSITIVE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, lower):
                    return True, f"matched_{category}_pattern"

        # Negation check within context window
        keyword_pos = lower.find(keyword.lower())
        if keyword_pos > -1:
            context_before = lower[max(0, keyword_pos - 60):keyword_pos]
            context_after = lower[keyword_pos:min(len(lower), keyword_pos + 60)]
            
            # Check for negation in both directions
            all_negations = (
                NEGATION_INDICATORS["direct"] +
                NEGATION_INDICATORS["contractions"] +
                NEGATION_INDICATORS["prevention"] +
                NEGATION_INDICATORS["absence"]
            )
            
            for neg in all_negations:
                if neg in context_before or neg in context_after:
                    return True, f"negation_detected:{neg}"

        return False, ""

    @classmethod
    def verify_with_spacy(cls, sentence: str, keyword: str) -> Dict:
        """Use spaCy for advanced verification"""
        if not HAS_SPACY:
            return {"available": False}

        doc = nlp(sentence)
        
        # Extract named entities
        entities = {
            "people": [ent.text for ent in doc.ents if ent.label_ in ["PERSON", "NORP"]],
            "locations": [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC", "FAC"]],
            "dates": [ent.text for ent in doc.ents if ent.label_ == "DATE"],
            "quantities": [ent.text for ent in doc.ents if ent.label_ in ["CARDINAL", "QUANTITY"]],
        }

        # Check if sentence is about a real event
        has_past_tense = any(token.tag_ in ["VBD", "VBN"] for token in doc)
        has_present_progressive = any(token.tag_ == "VBG" for token in doc)
        
        # Dependency analysis
        root_verb = [token for token in doc if token.dep_ == "ROOT"]
        is_statement = root_verb and root_verb[0].pos_ == "VERB"

        return {
            "available": True,
            "entities": entities,
            "has_past_tense": has_past_tense,
            "has_present_progressive": has_present_progressive,
            "is_statement": is_statement,
            "entity_count": sum(len(v) for v in entities.values()),
        }

    @classmethod
    def verify_keyword(
        cls,
        text: str,
        keyword: str,
        requires_strong_evidence: bool = False,
    ) -> Tuple[bool, float, Dict]:
        """
        Master verification with comprehensive analysis.
        
        Returns:
            (is_valid, confidence, metadata)
        """
        sentences = cls.get_sentences(text)
        
        valid_count = 0
        total_mentions = 0
        evidence_scores = []
        verification_details = []

        for sent in sentences:
            if keyword.lower() not in sent.lower():
                continue

            total_mentions += 1

            # False positive check
            is_fp, fp_reason = cls.is_false_positive(sent, keyword)
            if is_fp:
                verification_details.append({
                    "sentence": sent[:100],
                    "valid": False,
                    "reason": fp_reason,
                })
                continue

            # Evidence scoring
            evidence_score = cls.calculate_evidence_score(sent)
            evidence_scores.append(evidence_score)

            # spaCy analysis
            spacy_data = cls.verify_with_spacy(sent, keyword)

            # Validity decision
            is_valid_mention = False
            
            if requires_strong_evidence:
                # For critical keywords, need strong evidence
                is_valid_mention = evidence_score >= 0.5
            else:
                # For other keywords, lower threshold
                is_valid_mention = evidence_score >= 0.2 or spacy_data.get("entity_count", 0) >= 2

            if is_valid_mention:
                valid_count += 1
                verification_details.append({
                    "sentence": sent[:100],
                    "valid": True,
                    "evidence_score": evidence_score,
                    "spacy_entities": spacy_data.get("entity_count", 0),
                })

        # Final decision
        if valid_count == 0:
            return False, 0.0, {"details": verification_details}

        # Calculate confidence
        avg_evidence = sum(evidence_scores) / len(evidence_scores) if evidence_scores else 0.0
        mention_ratio = valid_count / max(total_mentions, 1)
        
        confidence = (avg_evidence * 0.6) + (mention_ratio * 0.4)

        return True, round(confidence, 3), {
            "valid_mentions": valid_count,
            "total_mentions": total_mentions,
            "avg_evidence_score": round(avg_evidence, 3),
            "details": verification_details[:3],  # First 3 for brevity
        }

    @classmethod
    def get_verified_sentences(cls, text: str, keyword: str) -> List[Dict]:
        """Get all verified sentences with metadata"""
        sentences = cls.get_sentences(text)
        verified = []

        for sent in sentences:
            if keyword.lower() not in sent.lower():
                continue

            is_fp, fp_reason = cls.is_false_positive(sent, keyword)
            if is_fp:
                continue

            evidence_score = cls.calculate_evidence_score(sent)
            if evidence_score >= 0.2:
                verified.append({
                    "sentence": sent,
                    "evidence_score": evidence_score,
                    "temporal_markers": cls.extract_temporal_markers(sent),
                    "has_reporting_verb": cls.has_reporting_verb(sent),
                    "has_location": cls.has_specific_location(sent),
                })

        return verified