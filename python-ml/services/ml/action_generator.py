import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

# ── Severity-based actions ────────────────────────────────────
SEVERITY_ACTIONS = {
    "critical": [
        "🚨 SEND TO COMMITTEE IMMEDIATELY — This is a life-threatening emergency",
        "Call emergency services (108 ambulance / 100 police / 101 fire) RIGHT NOW",
        "Alert senior NGO management and zone coordinator immediately",
        "Evacuate people from danger zone if safe to do so",
        "Document with photos/video as evidence before anything changes",
    ],
    "high": [
        "⚠️ Submit report to committee TODAY — do not delay",
        "Alert zone coordinator and senior field manager immediately",
        "Deploy field response team for on-ground assessment within hours",
        "Document all evidence with photos, videos, and witness statements",
        "Establish communication with district authority",
    ],
    "medium": [
        "📋 Submit report for committee review within 48-72 hours",
        "Conduct detailed field assessment with full documentation",
        "Coordinate with local authority and panchayat for resolution",
        "Monitor situation daily and update if it worsens",
        "Engage community leaders for immediate partial solutions",
    ],
    "low": [
        "📝 Include in weekly committee report",
        "Document for records and future reference",
        "Monitor monthly for any escalation",
        "Discuss in next regular committee meeting",
        "Engage gram panchayat for routine resolution",
    ],
    "info": [
        "📁 File for records — no immediate action required",
        "Review in next quarterly assessment",
        "Share with relevant department for awareness",
        "Continue monitoring",
    ],
}

# ── Category-specific actions (India context) ─────────────────
CATEGORY_ACTIONS: Dict[str, List[str]] = {
    "Health": [
        "Contact nearest PHC/CHC/district hospital — request immediate medical support",
        "Arrange emergency medicines and first aid supplies for affected people",
        "Report to District Health Officer (DHO) with full documentation",
        "Conduct rapid health assessment of all affected people",
        "Set up temporary health camp with available ASHA/ANM workers",
        "Ensure isolation if infectious disease suspected — prevent spread",
        "Contact State Disease Surveillance Unit if epidemic suspected",
    ],
    "Water": [
        "Arrange alternative clean drinking water supply IMMEDIATELY (water tanker)",
        "Distribute water purification tablets/chlorine tablets to families",
        "Conduct water quality test to identify contamination source",
        "Report to PHED (Public Health Engineering Department) for pipeline repair",
        "Repair/restore damaged handpump or borewell urgently",
        "Install temporary water storage tanks if supply will take time",
        "Alert district collector if water shortage affects entire area",
    ],
    "Sanitation": [
        "Arrange immediate waste collection and removal from affected area",
        "Deploy municipal sanitation workers/cleaning team",
        "Clear blocked drains to prevent waterlogging and disease",
        "Report to Gram Panchayat/Municipal Corporation sanitation department",
        "Conduct hygiene awareness session for community",
        "Install temporary toilets if permanent facilities damaged",
        "Arrange regular disinfection/fumigation to prevent disease spread",
        "Contact District Swachh Bharat Mission coordinator",
    ],
    "Food": [
        "Arrange IMMEDIATE emergency food distribution for affected families",
        "Contact District Food Supply Officer for emergency PDS grain release",
        "Verify ration card status of affected families — assist those without cards",
        "Assess children under 5 years for malnutrition (MUAC measurement)",
        "Coordinate with Anganwadi workers for supplementary nutrition (ICDS)",
        "Contact PM POSHAN/MDM coordinator for school meals continuity",
        "Apply for PM Garib Kalyan Anna Yojana benefits for affected families",
        "Connect families with local NGO food distribution programs",
    ],
    "Violence": [
        "Report to local police station IMMEDIATELY — file FIR with all details",
        "Ensure safety and immediate protection of victims",
        "Contact Women Helpline: 181 / Child Helpline: 1098 if applicable",
        "Connect victims with legal aid and counseling support",
        "Coordinate with District Women & Child Development Officer",
        "Arrange safe temporary shelter for victims if staying is unsafe",
        "Document all injuries with photos and medical reports as evidence",
        "Contact District Collector if authorities are unresponsive",
    ],
    "Disaster": [
        "Activate NGO emergency response protocol IMMEDIATELY",
        "Evacuate people from danger zone to designated relief camps",
        "Call NDRF/SDRF: 011-24363260 / District Disaster Management Authority",
        "Arrange emergency relief kit: food, water, medicines, blankets, tarpaulin",
        "Set up emergency communication center for coordination",
        "Conduct rapid needs assessment within 6 hours",
        "Coordinate with district administration for relief distribution",
        "Register all affected families for government relief schemes",
    ],
    "Education": [
        "Report to Block Education Officer (BEO) with supporting documentation",
        "Ensure Midday Meal (PM POSHAN) continuity for enrolled students",
        "Identify and engage dropout-risk children with home visits",
        "Arrange alternative learning space if school building damaged",
        "Coordinate with School Management Committee (SMC) for resolution",
        "Report to District Education Officer if BEO unresponsive",
        "Check RTE compliance — every child 6-14 years has right to education",
        "Engage ASHA/Anganwadi workers to track out-of-school children",
    ],
    "Shelter": [
        "Arrange immediate temporary shelter (tarpaulin, tent, community hall)",
        "Conduct structural safety assessment with qualified engineer",
        "Register families for PM Awas Yojana (Gramin/Urban) — housing scheme",
        "Apply for emergency state disaster relief housing assistance",
        "Coordinate with gram panchayat for interim housing support",
        "Document damage with photos, GPS coordinates for insurance claims",
        "Report to district revenue officer for disaster relief assessment",
        "Connect with state housing board for low-cost housing options",
    ],
    "Infrastructure": [
        "Report formally to Gram Panchayat/Ward Office with documentation",
        "File complaint with PWD (Public Works Department) for road/bridge",
        "File complaint with DISCOM/electricity department for power issues",
        "Document damage with photos, GPS coordinates, and date-stamps",
        "Follow up weekly in writing — keep record of all complaints",
        "Escalate to District Collector/SDM if local authority ignores",
        "Contact state-level helpline for public infrastructure complaints",
        "Engage local elected representative (MLA/Councilor/Sarpanch) for support",
    ],
    "Other": [
        "Document issue thoroughly with photos, statements, and GPS location",
        "Report to the most relevant local authority department",
        "Conduct community meeting to assess full impact",
        "Coordinate with appropriate government department",
        "Monitor weekly and update report with new developments",
        "Engage local elected representative for resolution",
        "Connect with district administration for formal intervention",
    ],
}

# ── Vulnerable group actions ──────────────────────────────────
VULNERABLE_GROUP_ACTIONS = {
    "children": [
        "Prioritize safety and welfare of children above all else",
        "Report to Child Welfare Committee (CWC) if children at risk",
        "Call Child Helpline 1098 for immediate child protection",
    ],
    "infant": [
        "Ensure immediate access to medical care for infants",
        "Contact ASHA/ANM for emergency newborn/infant care",
    ],
    "pregnant": [
        "Ensure immediate access to maternal healthcare",
        "Contact ASHA worker and ANM for emergency support",
        "Arrange transport to nearest maternity hospital if needed",
    ],
    "elderly": [
        "Ensure elderly have access to medicine, food, and care",
        "Assign community volunteer for daily welfare check",
        "Contact state senior citizen helpline for support",
    ],
    "disabled": [
        "Ensure accessible support and assistance for differently-abled",
        "Contact District Disability Welfare Officer for support",
        "Arrange home-based support if mobility is restricted",
    ],
    "women": [
        "Ensure safety and dignity of women in the situation",
        "Contact Women Helpline 181 if women face violence or discrimination",
        "Engage women SHG leaders for community-level support",
    ],
}


class ActionGenerator:
    """Generates context-aware, India-specific suggested actions"""

    @classmethod
    def generate(
        cls,
        severity: str,
        category: str,
        immediate: bool,
        text: str,
        top_n: int = 6,
    ) -> List[str]:
        """Generate ranked suggested actions"""
        actions = []

        # 1. Severity-based first (2 actions)
        sev_actions = SEVERITY_ACTIONS.get(severity, SEVERITY_ACTIONS["info"])
        actions.extend(sev_actions[:2])

        # 2. Immediate risk extra action
        if immediate and severity not in ["critical"]:
            actions.insert(
                1,
                "🚨 IMMEDIATE RISK DETECTED — Escalate to senior management NOW"
            )

        # 3. Category-specific (3 actions)
        cat_actions = CATEGORY_ACTIONS.get(category, CATEGORY_ACTIONS["Other"])
        actions.extend(cat_actions[:3])

        # 4. Vulnerable group actions (1 action each)
        lower = text.lower()
        for group, group_actions in VULNERABLE_GROUP_ACTIONS.items():
            if group in lower:
                actions.extend(group_actions[:1])
                if len(actions) >= top_n + 2:
                    break

        # Remove duplicates while preserving order
        seen = set()
        unique = []
        for action in actions:
            if action not in seen:
                seen.add(action)
                unique.append(action)

        return unique[:top_n]