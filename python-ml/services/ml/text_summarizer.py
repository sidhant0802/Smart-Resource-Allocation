import re
import logging
from typing import List, Tuple, Optional
from .context_checker import ContextChecker
from .scorer import SEVERITY_KEYWORDS

logger = logging.getLogger(__name__)


class TextSummarizer:
    """
    Generates summaries from report text using:
    1. Sentence scoring by severity relevance
    2. Key sentence extraction
    3. Structured summary generation
    """

    @staticmethod
    def get_sentences(text: str) -> List[str]:
        """Split into clean sentences"""
        raw = re.split(r'[.!?\n;]', text)
        return [s.strip() for s in raw if len(s.strip()) > 15]

    @staticmethod
    def score_sentence(sentence: str) -> float:
        """Score sentence by its relevance to severity"""
        score   = 0.0
        s_lower = sentence.lower()

        for level, data in SEVERITY_KEYWORDS.items():
            for word in data["words"]:
                if word in s_lower:
                    if not ContextChecker.is_false_positive(sentence, word):
                        score += data["base_weight"]

        # Boost sentences with numbers (more specific = more relevant)
        if re.search(r'\d+', sentence):
            score += 5.0

        # Boost sentences with location info
        if re.search(r'\b[A-Z][a-z]+\b', sentence):
            score += 3.0

        return score

    @classmethod
    def extract_key_sentences(
        cls,
        text:   str,
        top_n:  int = 5,
    ) -> List[Tuple[float, str]]:
        """Extract most relevant sentences"""
        sentences = cls.get_sentences(text)
        scored    = [(cls.score_sentence(s), s) for s in sentences]
        scored.sort(reverse=True)

        # Remove near-duplicates
        seen    = []
        unique  = []
        for score, sent in scored:
            is_dup = any(
                len(set(sent.lower().split()) &
                    set(s.lower().split())) /
                max(len(sent.split()), 1) > 0.7
                for s in seen
            )
            if not is_dup and score > 0:
                unique.append((score, sent))
                seen.append(sent)
            if len(unique) >= top_n:
                break

        return unique

    @classmethod
    def generate_short_summary(
        cls,
        text:            str,
        category:        str,
        severity:        str,
        urgency_score:   float,
        keywords:        List[str],
        affected_people: Optional[int],
        affected_area:   Optional[str],
        immediate_risk:  bool,
    ) -> str:
        """Generate 2-3 sentence short summary"""

        severity_label = {
            "critical": "⚠️ CRITICAL",
            "high":     "🔴 HIGH URGENCY",
            "medium":   "🟡 MODERATE",
            "low":      "🟢 LOW URGENCY",
            "info":     "⚪ INFORMATIONAL",
        }.get(severity, severity.upper())

        people_str = f" affecting approximately {affected_people} people" \
                     if affected_people else ""
        area_str   = f" in {affected_area}" if affected_area else ""
        risk_str   = " Immediate intervention is required." \
                     if immediate_risk else ""

        # Get most relevant sentence from report
        key_sentences = cls.extract_key_sentences(text, top_n=1)
        best_sentence = key_sentences[0][1] if key_sentences else ""

        summary = (
            f"{severity_label} {category} issue reported{area_str}{people_str}. "
            f"Urgency score: {urgency_score}/100.{risk_str}"
        )

        if best_sentence and len(best_sentence) < 200:
            summary += f" Key finding: {best_sentence}"

        return summary[:500]

    @classmethod
    def generate_detailed_analysis(
        cls,
        text:            str,
        category:        str,
        severity:        str,
        urgency_score:   float,
        keywords:        List[str],
        affected_people: Optional[int],
        affected_area:   Optional[str],
        immediate_risk:  bool,
        matched_keywords: List[str],
        sentiment:       str,
    ) -> str:
        """Generate comprehensive detailed analysis"""

        key_sentences = cls.extract_key_sentences(text, top_n=4)

        # Introduction
        people_str = f" affecting approximately {affected_people} people" \
                     if affected_people else ""
        area_str   = f" in {affected_area}" if affected_area else ""

        intro = (
            f"ML Pipeline Analysis Report: This is a {severity} severity "
            f"{category.lower()} situation{area_str}{people_str}. "
            f"The analysis pipeline assigned an urgency score of "
            f"{urgency_score}/100 based on context-aware keyword detection, "
            f"sentiment analysis ({sentiment}), category classification, "
            f"and impact assessment."
        )

        # Key findings from report
        findings = ""
        if key_sentences:
            extracted = [s[1] for s in key_sentences]
            findings = (
                " Key findings from the report: "
                + " | ".join(extracted[:3])[:400]
                + "."
            )

        # Keyword analysis
        kw_analysis = ""
        if matched_keywords:
            kw_analysis = (
                f" Severity indicators detected: "
                f"{', '.join(matched_keywords[:5])}."
            )

        # Recommendation
        if immediate_risk:
            recommendation = (
                " RECOMMENDATION: This report requires immediate escalation "
                "to the committee. Do not delay submission."
            )
        elif severity in ["high", "medium"]:
            recommendation = (
                " RECOMMENDATION: This report should be submitted to "
                "the committee within 24-48 hours for review."
            )
        else:
            recommendation = (
                " RECOMMENDATION: This report can be reviewed in "
                "the next regular committee meeting."
            )

        full = intro + findings + kw_analysis + recommendation

        return full[:1000]

    @classmethod
    def generate_key_problems(
        cls,
        text:     str,
        keywords: List[str],
    ) -> List[str]:
        """Extract key problems as bullet points"""
        key_sentences = cls.extract_key_sentences(text, top_n=6)
        problems = []

        for score, sent in key_sentences:
            if score > 0 and len(sent) > 10:
                # Clean sentence
                clean = sent.strip()
                # Remove leading conjunctions
                clean = re.sub(
                    r'^(?:and|but|also|however|moreover|furthermore)\s+',
                    '', clean, flags=re.IGNORECASE
                )
                if len(clean) > 10 and clean not in problems:
                    problems.append(clean)

        # Fallback from keywords
        if not problems and keywords:
            for kw in keywords[:4]:
                problems.append(f"Issue identified: {kw}")

        return problems[:5]