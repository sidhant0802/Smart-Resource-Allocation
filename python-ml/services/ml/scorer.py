# ml/scorer.py
import re
import logging
from typing import Tuple, Dict, Optional, List
from .context_checker import AdvancedContextChecker

logger = logging.getLogger(__name__)

# ── Tiered Severity Keywords ─────────────────────────────────
SEVERITY_KEYWORDS = {
    "tier_1_critical": {
        "base_weight": 45,
        "requires_strong_evidence": True,
        "keywords": [
            # Deaths (confirmed)
            "confirmed death", "death confirmed", "deaths confirmed",
            "found dead", "body found", "bodies found", "corpse discovered",
            "died today", "died yesterday", "died on",
            "fatality reported", "fatalities reported",
            "casualty confirmed", "casualties confirmed",
            "killed instantly", "died on spot",
            
            # Violence (confirmed)
            "murder reported", "murder case", "homicide",
            "rape reported", "rape case filed", "sexual assault reported",
            "gang rape", "child abuse reported",
            
            # Disasters (major)
            "building collapsed", "bridge collapsed", "dam burst",
            "major fire broke out", "fire engulfed",
            "earthquake struck", "tremors felt",
            "flash flood", "cloudburst hit",
            
            # Health (severe outbreaks)
            "epidemic declared", "outbreak confirmed",
            "cholera outbreak", "dengue outbreak",
            "mass poisoning", "food poisoning outbreak",
        ],
    },
    "tier_2_high": {
        "base_weight": 30,
        "requires_strong_evidence": True,
        "keywords": [
            # Health emergencies
            "hospitalized urgently", "critical condition",
            "icu admission", "emergency surgery",
            "serious injury", "severely injured",
            "unconscious patient", "collapsed suddenly",
            
            # Disease spread
            "spreading rapidly", "infection spreading",
            "many falling sick", "outbreak suspected",
            "symptoms worsening", "health crisis",
            
            # Displacement/Shelter
            "families displaced", "homes destroyed",
            "living on streets", "no shelter available",
            "forced eviction", "homeless families",
            
            # Hunger/Food
            "acute starvation", "children malnourished",
            "no food for days", "severe malnutrition",
            "famine conditions", "food crisis",
            
            # Violence/Abuse
            "domestic violence reported", "physical abuse",
            "assault reported", "beating incident",
            "harassment complaint", "threat to life",
        ],
    },
    "tier_3_medium": {
        "base_weight": 18,
        "requires_strong_evidence": False,
        "keywords": [
            # Infrastructure damage
            "road badly damaged", "bridge unsafe",
            "power cut for days", "no electricity since",
            
            # Water/Sanitation
            "water contaminated", "water shortage",
            "sewage overflow", "drain blocked",
            "garbage accumulation", "sanitation crisis",
            
            # Education
            "school non-functional", "teachers absent",
            "children dropping out", "no midday meal",
            
            # Health (moderate)
            "people falling ill", "health concerns",
            "medical attention needed", "clinic closed",
        ],
    },
    "tier_4_low": {
        "base_weight": 8,
        "requires_strong_evidence": False,
        "keywords": [
            # Minor issues
            "minor repair needed", "maintenance required",
            "slight delay", "small problem",
            "needs attention", "could improve",
        ],
    },
}

# ── Context Boosters ──────────────────────────────────────────
CONTEXT_BOOSTERS = {
    "temporal_urgency": {
        "score": 8.0,
        "patterns": [
            r'\b(right now|immediately|urgent|emergency|critical now)\b',
            r'\b(cannot wait|asap|very urgent|extremely urgent)\b',
            r'\b(life threatening|life at risk|dying)\b',
        ],
    },
    "repeat_occurrence": {
        "score": 6.0,
        "patterns": [
            r'\b(repeated|recurring|again|multiple times|every day)\b',
            r'\b(for weeks|for months|since long|chronic)\b',
        ],
    },
    "authority_failure": {
        "score": 5.0,
        "patterns": [
            r'\b(ignored|neglected|no action|complaint ignored)\b',
            r'\b(officials not responding|authorities inactive)\b',
        ],
    },
    "media_coverage": {
        "score": 4.0,
        "patterns": [
            r'\b(media reported|news covered|tv report)\b',
        ],
    },
}

# ── Vulnerability Multipliers ─────────────────────────────────
VULNERABILITY_FACTORS = {
    "age_vulnerable": {
        "multiplier": 1.25,
        "keywords": ["children", "infant", "newborn", "toddler", "elderly", "senior citizen", "aged"],
    },
    "health_vulnerable": {
        "multiplier": 1.20,
        "keywords": ["pregnant", "pregnant woman", "expecting mother", "disabled", "differently abled", "bedridden"],
    },
    "social_vulnerable": {
        "multiplier": 1.15,
        "keywords": ["tribal", "minority", "marginalized", "daily wage", "migrant worker", "homeless"],
    },
    "geographic_vulnerable": {
        "multiplier": 1.12,
        "keywords": ["remote area", "inaccessible", "cut off", "isolated village"],
    },
}

# ── De-escalation Factors ─────────────────────────────────────
DE_ESCALATION_FACTORS = {
    "resolved": {
        "multiplier": 0.30,
        "keywords": ["already resolved", "has been fixed", "situation controlled", "problem solved"],
    },
    "preventive": {
        "multiplier": 0.50,
        "keywords": ["preventive measure", "precautionary", "to avoid", "in case of"],
    },
    "old_news": {
        "multiplier": 0.60,
        "keywords": ["last year", "years ago", "old news", "past incident"],
    },
}


class AdvancedUrgencyScorer:
    """
    Multi-factor urgency scoring with advanced ML techniques
    """

    @classmethod
    def score_verified_keywords(cls, text: str) -> Tuple[float, List[str], Dict]:
        """
        Score using context-verified keywords with tiered weights
        """
        max_score = 0.0
        matched_keywords = []
        verification_data = {}

        for tier, config in SEVERITY_KEYWORDS.items():
            tier_score = 0.0
            tier_matches = []

            for keyword in config["keywords"]:
                is_valid, confidence, metadata = AdvancedContextChecker.verify_keyword(
                    text=text,
                    keyword=keyword,
                    requires_strong_evidence=config["requires_strong_evidence"],
                )

                if is_valid:
                    # Score = base_weight × confidence
                    keyword_score = config["base_weight"] * confidence
                    tier_score += keyword_score
                    tier_matches.append({
                        "keyword": keyword,
                        "confidence": confidence,
                        "score": keyword_score,
                    })

            if tier_matches:
                # Cap tier score at base_weight
                capped_score = min(config["base_weight"], tier_score)
                max_score = max(max_score, capped_score)
                matched_keywords.extend([m["keyword"] for m in tier_matches[:3]])
                verification_data[tier] = tier_matches[:3]

        return round(max_score, 2), matched_keywords, verification_data

    @classmethod
    def calculate_context_boosters(cls, text: str) -> Tuple[float, List[str]]:
        """Calculate additional score from context boosters"""
        boost_score = 0.0
        reasons = []

        for booster_name, config in CONTEXT_BOOSTERS.items():
            for pattern in config["patterns"]:
                if re.search(pattern, text, re.IGNORECASE):
                    boost_score += config["score"]
                    reasons.append(booster_name)
                    break  # Only count each booster once

        return min(15.0, boost_score), reasons

    @classmethod
    def calculate_vulnerability_multiplier(cls, text: str) -> Tuple[float, List[str]]:
        """Calculate vulnerability multiplier"""
        multiplier = 1.0
        factors = []

        lower = text.lower()
        for factor_name, config in VULNERABILITY_FACTORS.items():
            if any(kw in lower for kw in config["keywords"]):
                multiplier *= config["multiplier"]
                factors.append(factor_name)

        return round(min(multiplier, 1.5), 3), factors

    @classmethod
    def calculate_de_escalation(cls, text: str) -> Tuple[float, List[str]]:
        """Calculate de-escalation multiplier"""
        multiplier = 1.0
        factors = []

        lower = text.lower()
        for factor_name, config in DE_ESCALATION_FACTORS.items():
            if any(kw in lower for kw in config["keywords"]):
                multiplier *= config["multiplier"]
                factors.append(factor_name)

        return round(max(multiplier, 0.25), 3), factors

    @classmethod
    def score_affected_scale(cls, affected_people: Optional[int]) -> float:
        """Enhanced scale scoring with exponential growth"""
        if not affected_people:
            return 2.0
        
        # Exponential scale for large numbers
        if affected_people >= 100000: return 15.0
        if affected_people >= 50000:  return 13.0
        if affected_people >= 10000:  return 11.0
        if affected_people >= 5000:   return 9.0
        if affected_people >= 1000:   return 7.0
        if affected_people >= 500:    return 6.0
        if affected_people >= 100:    return 5.0
        if affected_people >= 50:     return 4.0
        if affected_people >= 10:     return 3.0
        return 2.5

    @classmethod
    def calculate_comprehensive_score(
        cls,
        text: str,
        sentiment: str,
        category: str,
        has_file: bool,
        affected_people: Optional[int],
        indicators: Dict[str, bool],
    ) -> Tuple[float, str, str, Dict]:
        """
        Master scoring with comprehensive multi-factor analysis
        
        Returns:
            (final_score, severity_level, explanation, metadata)
        """
        # Component scores
        keyword_score, matched_kw, verification_data = cls.score_verified_keywords(text)
        context_boost, boost_reasons = cls.calculate_context_boosters(text)
        
        # Sentiment score
        sentiment_scores = {
            "very_negative": 18.0,
            "negative": 12.0,
            "neutral": 4.0,
            "positive": 1.0,
        }
        sentiment_score = sentiment_scores.get(sentiment, 4.0)

        # Category score
        category_scores = {
            "Health": 18, "Violence": 18, "Disaster": 18,
            "Water": 15, "Food": 15, "Sanitation": 13,
            "Shelter": 12, "Education": 8, "Infrastructure": 6,
            "Other": 3,
        }
        category_score = float(category_scores.get(category, 3))

        # Evidence score
        evidence_score = 12.0 if has_file else 4.0
        if sum(indicators.values()) >= 3:
            evidence_score += 3.0

        # Affected people score
        people_score = cls.score_affected_scale(affected_people)

        # Raw total (before multipliers)
        raw_total = (
            keyword_score +
            context_boost +
            sentiment_score +
            category_score +
            evidence_score +
            people_score
        )

        # Apply multipliers
        vuln_multiplier, vuln_factors = cls.calculate_vulnerability_multiplier(text)
        de_esc_multiplier, de_esc_factors = cls.calculate_de_escalation(text)

        # Final score
        final_score = raw_total * vuln_multiplier * de_esc_multiplier
        final_score = round(max(0.0, min(100.0, final_score)), 1)

        # Severity determination with stricter thresholds
        if final_score >= 85:   severity = "critical"
        elif final_score >= 65: severity = "high"
        elif final_score >= 40: severity = "medium"
        elif final_score >= 20: severity = "low"
        else:                   severity = "info"

        # Comprehensive explanation
        components = [
            f"Keywords({keyword_score:.1f})",
            f"Context({context_boost:.1f})",
            f"Sentiment({sentiment_score:.1f})",
            f"Category({category_score:.1f})",
            f"Evidence({evidence_score:.1f})",
            f"Scale({people_score:.1f})",
        ]

        explanation_parts = [f"Score: {final_score}/100 ({severity.upper()})"]
        explanation_parts.append(f"Components: {' + '.join(components)}")
        
        if vuln_multiplier != 1.0:
            explanation_parts.append(f"Vulnerability: ×{vuln_multiplier} ({', '.join(vuln_factors)})")
        if de_esc_multiplier != 1.0:
            explanation_parts.append(f"De-escalation: ×{de_esc_multiplier} ({', '.join(de_esc_factors)})")

        explanation = " | ".join(explanation_parts)

        # Metadata
        metadata = {
            "verification_data": verification_data,
            "matched_keywords": matched_kw[:10],
            "boost_reasons": boost_reasons,
            "vulnerability_factors": vuln_factors,
            "de_escalation_factors": de_esc_factors,
            "raw_score": round(raw_total, 1),
            "multipliers": {
                "vulnerability": vuln_multiplier,
                "de_escalation": de_esc_multiplier,
            },
        }

        logger.info(
            f"Advanced Scoring: {final_score}/100 ({severity}) | "
            f"Raw: {raw_total:.1f} | Verified KW: {len(matched_kw)}"
        )

        return final_score, severity, explanation, metadata


        # services/ml/scorer.py

# ... all your AdvancedUrgencyScorer code ...

# ✅ Backward compatibility wrapper
class UrgencyScorer:
    """Backward compatibility wrapper for AdvancedUrgencyScorer"""
    
    @classmethod
    def calculate(
        cls,
        text: str,
        sentiment: str,
        category: str,
        has_file: bool,
        affected_people: Optional[int],
        indicators: Dict[str, bool],
    ) -> Tuple[float, str, str, List[str]]:
        """
        Legacy method signature.
        Returns: (score, severity, explanation, matched_keywords)
        """
        score, severity, explanation, metadata = AdvancedUrgencyScorer.calculate_comprehensive_score(
            text=text,
            sentiment=sentiment,
            category=category,
            has_file=has_file,
            affected_people=affected_people,
            indicators=indicators,
        )
        
        matched_keywords = metadata.get("matched_keywords", [])
        
        return score, severity, explanation, matched_keywords