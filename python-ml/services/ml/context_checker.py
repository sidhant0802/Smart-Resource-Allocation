import re
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

# ── Complete False Positive Phrases ──────────────────────────
FALSE_POSITIVE_PHRASES = [
    # General statements about death concept
    "who die", "who dies", "who died", "who will die",
    "people die", "people dies", "people died", "people who die",
    "those who die", "those who died", "ones who die",
    "everyone dies", "nobody dies", "no one dies",
    "when people die", "after people die",
    "if someone dies", "if people die", "if they die",
    "will die someday", "will never come back",
    "cannot come back", "can not come back",
    "never come back", "won't come back",
    "dead cannot", "dead can not",
    "died cannot", "died can not",

    # Philosophical / general truth statements
    "death is inevitable", "death is natural",
    "death is certain", "we all die",
    "life and death", "birth and death",
    "after death", "before death",
    "fear of death", "fear of dying",
    "risk of death", "chance of dying",
    "could die", "might die", "may die",
    "would die", "used to die",

    # Historical / educational
    "died in the past", "used to die",
    "historically", "in olden times",
    "during the war", "years ago",
    "in ancient", "long ago",

    # Metaphorical
    "killing time", "dead tired", "dead serious",
    "dead end", "dead wrong", "dead silence",
    "die laughing", "die of laughter",
    "dying to know", "dying to see",
    "dying for", "to die for",
    "flooded with", "fire sale",
    "bombed the exam", "explosive growth",
    "viral content", "viral marketing",

    # Hypothetical / conditional
    "what if", "suppose that", "imagine if",
    "in theory", "hypothetically",
    "example of", "for example",
    "like when", "similar to",

    # Already resolved
    "already resolved", "has been resolved",
    "was resolved", "situation controlled",
    "under control", "no longer a problem",
    "police arrested", "has been fixed",

    # Rumor / hearsay
    "i heard", "people say", "they say",
    "rumor", "allegedly", "supposedly",
    "according to rumor", "someone told me",

    # Proverbs / quotes
    "old saying", "proverb", "they say",
    "as they say", "it is said",
]

# ── Negation Words ────────────────────────────────────────────
NEGATION_WORDS = [
    "not", "no", "never", "nobody", "nothing", "nowhere",
    "cannot", "can't", "won't", "don't", "didn't", "doesn't",
    "wasn't", "weren't", "haven't", "hasn't", "hadn't",
    "without", "free from", "prevented", "avoided",
    "controlled", "stopped", "halted", "ended",
    "nobody", "no one", "none",
]

# ── Words that CONFIRM real incident ─────────────────────────
EVIDENCE_WORDS = [
    # Time (happened recently)
    "today", "yesterday", "this morning", "last night",
    "this week", "last week", "just now", "currently",
    "ongoing", "still", "continues", "since last",
    "hours ago", "days ago",

    # Reporting words (someone reported it)
    "reported", "confirmed", "witnessed", "seen",
    "found", "discovered", "detected", "diagnosed",
    "verified", "documented", "recorded", "informed",
    "we saw", "i saw", "we found", "i found",

    # Location (it happened somewhere specific)
    "in our area", "in our village", "in our colony",
    "near our", "at our", "in this area", "here in",
    "in our ward", "in our block", "at the site",

    # Quantity (specific numbers = real incident)
    "at least", "approximately", "around", "over",
    "more than", "several", "multiple", "many people",
    "hundreds", "thousands",

    # Urgency words
    "urgently", "immediately", "right now",
    "as soon as possible", "cannot wait",
    "need help", "please help", "requesting help",
]

# ── Patterns that mean it is NOT a real incident ─────────────
HYPOTHETICAL_PATTERNS = [
    r'\b(if|suppose|imagine|hypothetically)\b',
    r'\b(could have|would have|should have|might have)\b',
    r'\b(in general|generally|usually|typically|often|always)\b',
    r'\b(everybody|everyone|all people|humans)\s+(die|dies|will die)\b',
    r'\b(i heard|they say|people say|rumor|allegedly)\b',
    r'\b(never come back|cannot come back|can.t come back)\b',
    r'\b(will never|would never|could never)\b',
    r'\b(someday|eventually|one day|at some point)\b',
    r'\bwho (die|dies|died|will die)\b',
    # "people who die/died" pattern
    r'\b(people|those|ones|anyone|someone)\s+who\s+(die|dies|died)\b',
]


class ContextChecker:

    @staticmethod
    def get_sentences(text: str) -> List[str]:
        """Split text into sentences"""
        raw = re.split(r'[.!?\n;]', text)
        return [s.strip() for s in raw if len(s.strip()) > 5]

    @staticmethod
    def is_hypothetical(sentence: str) -> bool:
        """Check if sentence is hypothetical/general"""
        lower = sentence.lower()
        for pattern in HYPOTHETICAL_PATTERNS:
            if re.search(pattern, lower):
                logger.debug(f"Hypothetical: '{sentence[:60]}'")
                return True
        return False

    @staticmethod
    def has_false_positive_phrase(sentence: str) -> bool:
        """Check against known false positive phrases"""
        lower = sentence.lower()
        for phrase in FALSE_POSITIVE_PHRASES:
            if phrase in lower:
                logger.debug(f"FP phrase '{phrase}' in: '{sentence[:60]}'")
                return True
        return False

    @staticmethod
    def has_negation_before(sentence: str, keyword: str) -> bool:
        """Check negation within 50 chars before keyword"""
        lower       = sentence.lower()
        keyword_pos = lower.find(keyword)
        if keyword_pos == -1:
            return False
        context_before = lower[max(0, keyword_pos - 50):keyword_pos]
        return any(neg in context_before for neg in NEGATION_WORDS)

    @staticmethod
    def has_evidence(sentence: str) -> bool:
        """Check if sentence has evidence of real incident"""
        lower = sentence.lower()
        return any(word in lower for word in EVIDENCE_WORDS)

    @classmethod
    def is_false_positive(cls, sentence: str, keyword: str) -> bool:
        """
        Master check.
        Returns True = keyword is NOT a real incident (ignore it).
        Returns False = keyword IS real (count it).
        """
        # Check 1: Known false positive phrases
        if cls.has_false_positive_phrase(sentence):
            return True

        # Check 2: Hypothetical/general pattern
        if cls.is_hypothetical(sentence):
            return True

        # Check 3: Negation before keyword
        if cls.has_negation_before(sentence, keyword):
            return True

        return False

    @classmethod
    def verify_keyword(
        cls,
        text:             str,
        keyword:          str,
        requires_evidence: bool = False,
    ) -> Tuple[bool, float]:
        """
        Verify keyword is a REAL incident in context.

        Returns:
            (is_real, confidence 0.0-1.0)
        """
        lower     = text.lower()
        sentences = cls.get_sentences(text)

        if keyword not in lower:
            return False, 0.0

        valid_count  = 0
        total_count  = 0
        has_evidence = False

        for sent in sentences:
            if keyword not in sent.lower():
                continue

            total_count += 1

            # ❌ Skip false positives
            if cls.is_false_positive(sent, keyword):
                continue

            # If evidence required, must also have evidence words
            if requires_evidence:
                if cls.has_evidence(sent):
                    valid_count += 1
                    has_evidence = True
                # else: keyword found but no evidence = don't count
            else:
                valid_count += 1
                if cls.has_evidence(sent):
                    has_evidence = True

        if valid_count == 0:
            return False, 0.0

        # Confidence
        ratio      = valid_count / max(total_count, 1)
        confidence = ratio
        if has_evidence:
            confidence = min(1.0, confidence + 0.25)

        return True, round(confidence, 3)

    @classmethod
    def get_verified_sentences(cls, text: str, keyword: str) -> List[str]:
        """Get sentences where keyword is genuinely a real incident"""
        sentences = cls.get_sentences(text)
        verified  = []
        for sent in sentences:
            if keyword in sent.lower():
                if not cls.is_false_positive(sent, keyword):
                    verified.append(sent.strip())
        return verified