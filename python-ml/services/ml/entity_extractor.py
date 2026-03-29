import re
import logging
from typing import Optional, List, Dict, Tuple

logger = logging.getLogger(__name__)

# ── Number word mapping ───────────────────────────────────────
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "hundred": 100, "thousand": 1000, "lakh": 100000,
    "crore": 10000000,
}

# ── Location indicators ───────────────────────────────────────
LOCATION_INDICATORS = [
    "village", "district", "block", "taluka", "panchayat",
    "ward", "area", "region", "zone", "colony", "mohalla",
    "nagar", "gram", "tehsil", "mandal", "circle",
]


class EntityExtractor:
    """
    Extracts structured entities from report text:
    - Number of affected people
    - Location names
    - Time references
    - Contact details
    - Specific numbers/statistics
    """

    @staticmethod
    def extract_numbers(text: str) -> List[int]:
        """Extract all meaningful numbers from text"""
        numbers = []

        # Digit patterns with commas
        for match in re.findall(r'\b(\d{1,3}(?:,\d{3})*|\d+)\b', text):
            try:
                num = int(match.replace(',', ''))
                if 1 <= num <= 10_000_000:
                    numbers.append(num)
            except ValueError:
                pass

        # Word numbers
        lower = text.lower()
        for word, value in NUMBER_WORDS.items():
            if re.search(rf'\b{word}\b', lower):
                numbers.append(value)

        return numbers

    @staticmethod
    def extract_affected_people(text: str) -> Optional[int]:
        """
        Extract number of affected people with multiple patterns.
        Returns the most likely number.
        """
        patterns = [
            # Direct affected count
            r'(\d[\d,]*)\s*(?:people|persons|individuals|residents|villagers|families|households)\s*(?:are|were|have been|got|became)?\s*(?:affected|sick|injured|ill|homeless|displaced|infected|dead|died)',
            # Reverse pattern
            r'(?:affected|sick|injured|ill|homeless|displaced|infected)\s*(?:are|is)?\s*(\d[\d,]*)\s*(?:people|persons|families)',
            # Approximate counts
            r'(?:over|about|around|approximately|nearly|almost|more than|at least)\s*(\d[\d,]*)\s*(?:people|persons|families|households)',
            # Population
            r'(?:population|inhabitants)\s*of\s*(?:about|around|over|nearly)?\s*(\d[\d,]*)',
            # Homes/houses affected
            r'(\d[\d,]*)\s*(?:homes|houses|huts|structures)\s*(?:are|were|have been)?\s*(?:affected|damaged|destroyed|flooded)',
            # Children count
            r'(\d[\d,]*)\s*(?:children|kids|students|patients)\s*(?:are|were)?\s*(?:affected|sick|malnourished|suffering)',
            # Lakh/crore patterns
            r'(\d+(?:\.\d+)?)\s*lakh\s*(?:people|persons|families)',
            r'(\d+(?:\.\d+)?)\s*crore\s*(?:people|persons)',
        ]

        candidates = []

        for pattern in patterns:
            for match in re.findall(pattern, text, re.IGNORECASE):
                try:
                    num_str = str(match).replace(',', '')
                    # Handle lakh/crore in text
                    if 'lakh' in pattern:
                        num = int(float(num_str) * 100000)
                    elif 'crore' in pattern:
                        num = int(float(num_str) * 10000000)
                    else:
                        num = int(num_str)

                    if 1 <= num <= 50_000_000:
                        candidates.append(num)
                except (ValueError, TypeError):
                    pass

        if not candidates:
            return None

        # Return most significant number
        return max(candidates)

    @staticmethod
    def extract_location(text: str) -> Optional[str]:
        """
        Extract location with multiple strategies.
        """
        # Strategy 1: Location indicators
        patterns = [
            # "in XYZ village/district"
            r'(?:in|at|near|from)\s+([A-Z][a-zA-Z\s]{2,25})\s+(?:' +
            '|'.join(LOCATION_INDICATORS) + ')',
            # "XYZ village/district"
            r'([A-Z][a-zA-Z\s]{2,20})\s+(?:' +
            '|'.join(LOCATION_INDICATORS) + ')',
            # "village/district of XYZ"
            r'(?:' + '|'.join(LOCATION_INDICATORS) + r')\s+(?:of\s+)?([A-Z][a-zA-Z\s]{2,25})',
        ]

        locations = []
        for pattern in patterns:
            for match in re.findall(pattern, text):
                loc = match.strip()
                # Filter common false positives
                if (len(loc) > 2 and
                    loc.lower() not in ['the', 'our', 'this', 'that', 'here']):
                    locations.append(loc)

        if locations:
            return locations[0]

        # Strategy 2: Capitalized words near location words
        words = text.split()
        for i, word in enumerate(words):
            if word.lower() in LOCATION_INDICATORS and i > 0:
                prev = words[i - 1]
                if prev[0].isupper() and len(prev) > 2:
                    return prev

        return None

    @staticmethod
    def extract_time_references(text: str) -> List[str]:
        """Extract time references from text"""
        patterns = [
            r'\b(today|yesterday|this morning|last night|this week|last week)\b',
            r'\b(\d+)\s*(days?|weeks?|months?|years?)\s*ago\b',
            r'\b(since\s+(?:last\s+)?\w+)\b',
            r'\b(for\s+(?:the\s+)?(?:past|last)\s+\d+\s*\w+)\b',
            r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',
        ]

        refs = []
        for pattern in patterns:
            for match in re.findall(pattern, text, re.IGNORECASE):
                ref = match if isinstance(match, str) else match[0]
                if ref.strip():
                    refs.append(ref.strip())

        return refs[:5]

    @staticmethod
    def extract_contact_info(text: str) -> Dict[str, List[str]]:
        """Extract phone numbers and emails"""
        phones = re.findall(
            r'\b(?:\+91|0)?[6-9]\d{9}\b', text
        )
        emails = re.findall(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            text
        )

        return {
            "phones": phones[:3],
            "emails": emails[:3],
        }

    @staticmethod
    def extract_severity_indicators(text: str) -> Dict[str, bool]:
        """Extract specific severity indicators"""
        lower = text.lower()

        return {
            "has_deaths":        any(w in lower for w in [
                "died", "death", "dead", "killed", "fatality"
            ]),
            "has_injuries":      any(w in lower for w in [
                "injured", "hurt", "wounded", "hospitalized"
            ]),
            "has_disease":       any(w in lower for w in [
                "disease", "epidemic", "outbreak", "infection", "virus"
            ]),
            "has_food_crisis":   any(w in lower for w in [
                "starvation", "famine", "hunger", "malnutrition"
            ]),
            "has_water_crisis":  any(w in lower for w in [
                "no water", "water shortage", "contaminated water"
            ]),
            "has_violence":      any(w in lower for w in [
                "attack", "assault", "violence", "abuse", "rape"
            ]),
            "has_displacement":  any(w in lower for w in [
                "homeless", "displaced", "evacuated", "no shelter"
            ]),
            "has_children":      any(w in lower for w in [
                "children", "child", "kids", "students", "infant"
            ]),
            "has_women":         any(w in lower for w in [
                "women", "woman", "girls", "pregnant", "mother"
            ]),
            "has_elderly":       any(w in lower for w in [
                "elderly", "old people", "senior citizen", "aged"
            ]),
        }

    @classmethod
    def extract_all(cls, text: str) -> Dict:
        """Run all entity extraction"""
        return {
            "affected_people": cls.extract_affected_people(text),
            "location":        cls.extract_location(text),
            "time_refs":       cls.extract_time_references(text),
            "contact_info":    cls.extract_contact_info(text),
            "indicators":      cls.extract_severity_indicators(text),
        }