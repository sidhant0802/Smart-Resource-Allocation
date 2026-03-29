import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

# ── Action Templates ──────────────────────────────────────────
SEVERITY_ACTIONS = {
    "critical": [
        "⚠️ SEND TO COMMITTEE IMMEDIATELY — Do not delay",
        "Alert senior NGO management and zone coordinator NOW",
        "Call emergency services if life is at risk",
        "Document everything with photos/video as evidence",
    ],
    "high": [
        "Submit report to committee within 24 hours",
        "Escalate to zone coordinator immediately",
        "Deploy field team for on-ground assessment",
        "Document with photos and witness statements",
    ],
    "medium": [
        "Submit report for committee review within this week",
        "Conduct detailed field assessment with documentation",
        "Coordinate with local authority for quick resolution",
        "Monitor situation daily for any escalation",
    ],
    "low": [
        "Include in weekly committee report",
        "Document for records and future reference",
        "Monitor situation monthly for changes",
        "Discuss in next regular committee meeting",
    ],
    "info": [
        "File for records — no immediate action required",
        "Review in next quarterly assessment",
        "Share with relevant department for awareness",
    ],
}

CATEGORY_ACTIONS: Dict[str, List[str]] = {
    "Health": [
        "Deploy medical team to affected area within 24 hours",
        "Arrange emergency medicines and first aid supplies",
        "Coordinate with nearest PHC/CHC/district hospital",
        "Conduct health camp for affected population",
        "Report to district health officer if epidemic suspected",
        "Ensure clean water and sanitation to prevent spread",
    ],
    "Water": [
        "Arrange alternative clean water supply immediately",
        "Conduct water quality test to identify contamination",
        "Repair damaged pipeline/handpump/borewell urgently",
        "Distribute water purification tablets to families",
        "Report to water and sanitation department (PHED)",
        "Install temporary water storage tanks",
    ],
    "Sanitation": [
        "Arrange immediate waste collection and disposal",
        "Deploy sanitation workers and cleaning equipment",
        "Install temporary toilet/latrine if permanent missing",
        "Conduct hygiene awareness session for community",
        "Report to municipal/gram panchayat sanitation department",
        "Arrange regular disinfection of affected area",
    ],
    "Food": [
        "Arrange emergency food distribution immediately",
        "Verify ration card eligibility of affected families",
        "Contact district PDS officer for emergency grain supply",
        "Assess children under 5 for malnutrition urgently",
        "Coordinate with anganwadi for supplementary nutrition",
        "Report to district food supply officer",
    ],
    "Violence": [
        "Report to local police station with full details",
        "Ensure immediate safety and protection of victims",
        "Provide emergency legal aid and counseling support",
        "Contact women/child helpline (1091/1098) if applicable",
        "Coordinate with district women and child welfare officer",
        "Arrange safe shelter for victims if needed",
    ],
    "Disaster": [
        "Activate NGO emergency response protocol immediately",
        "Evacuate affected families to designated relief camps",
        "Coordinate with NDRF/SDRF/district disaster authority",
        "Arrange emergency relief — food, water, medicines, shelter",
        "Set up emergency helpline and communication center",
        "Conduct rapid needs assessment within 6 hours",
    ],
    "Education": [
        "Report to Block Education Officer (BEO) with documentation",
        "Arrange temporary learning space if school non-functional",
        "Identify and reach out to dropout-risk children",
        "Coordinate with school management committee (SMC)",
        "Ensure midday meal continuity for enrolled students",
        "Follow up with district education department",
    ],
    "Shelter": [
        "Arrange immediate temporary shelter for displaced families",
        "Conduct structural damage assessment with engineer",
        "Apply for PM Awas Yojana or state housing scheme",
        "Provide emergency repair materials (tarpaulin, etc.)",
        "Report to district housing/revenue officer",
        "Coordinate with local gram panchayat for support",
    ],
    "Infrastructure": [
        "Report formally to gram panchayat/municipal office",
        "Submit complaint to PWD/electricity department",
        "Arrange temporary fix to ensure safety",
        "Document damage with photos and GPS location",
        "Follow up weekly with concerned authority",
        "Escalate to district collector if ignored",
    ],
    "Other": [
        "Document issue thoroughly with photos and statements",
        "Report to relevant local authority",
        "Conduct community meeting to assess full impact",
        "Coordinate with appropriate government department",
        "Monitor and report progress weekly",
    ],
}

# ── Vulnerable group specific actions ─────────────────────────
VULNERABLE_GROUP_ACTIONS = {
    "children": [
        "Prioritize protection and welfare of children",
        "Contact child helpline 1098 if children at risk",
    ],
    "pregnant": [
        "Ensure immediate access to maternal healthcare",
        "Contact ASHA worker and ANM for support",
    ],
    "elderly": [
        "Ensure elderly have access to medicine and care",
        "Assign community volunteer for daily check",
    ],
    "disabled": [
        "Ensure accessible support and assistance",
        "Coordinate with disability welfare department",
    ],
}


class ActionGenerator:
    """
    Generates context-aware suggested actions based on:
    1. Severity level
    2. Category
    3. Vulnerable groups present
    4. Immediate risk level
    """

    @classmethod
    def generate(
        cls,
        severity:    str,
        category:    str,
        immediate:   bool,
        text:        str,
        top_n:       int = 6,
    ) -> List[str]:
        """Generate ranked suggested actions"""
        actions = []

        # 1. Severity-based actions first
        sev_actions = SEVERITY_ACTIONS.get(severity, SEVERITY_ACTIONS["info"])
        actions.extend(sev_actions[:2])

        # 2. Category-specific actions
        cat_actions = CATEGORY_ACTIONS.get(category, CATEGORY_ACTIONS["Other"])
        actions.extend(cat_actions[:3])

        # 3. Vulnerable group actions
        lower = text.lower()
        for group, group_actions in VULNERABLE_GROUP_ACTIONS.items():
            if group in lower:
                actions.extend(group_actions[:1])

        # 4. Extra immediate action
        if immediate and severity not in ["critical"]:
            actions.insert(1, "🚨 Escalate to senior management — immediate risk detected")

        # Remove duplicates while preserving order
        seen    = set()
        unique  = []
        for action in actions:
            if action not in seen:
                seen.add(action)
                unique.append(action)

        return unique[:top_n]