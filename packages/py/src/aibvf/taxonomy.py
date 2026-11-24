INDUSTRIES = [
    "universal", "creative", "education", "energy", "financial", "healthcare",
    "logistics", "manufacturing", "nonprofit", "professional", "public_sector",
    "real_estate", "retail", "technology",
]

FUNCTIONS = ["finance", "hr", "sales", "supply", "cx", "risk", "it", "rd"]
AI_TIERS = ["gen1", "gen2", "gen3"]
READINESS = ["agile", "traditional", "siloed"]

# Where a governance estimate starts higher. The same two sets as @aibvf/core.
REGULATED_FUNCTIONS = frozenset({"risk", "finance", "hr"})
REGULATED_INDUSTRIES = frozenset({"financial", "healthcare", "public_sector", "energy"})

INDUSTRY_LABEL = {
    "universal": "Universal / Other",
    "creative": "Creative & Media",
    "education": "Education & Research",
    "energy": "Energy & Utilities",
    "financial": "Financial Services",
    "healthcare": "Healthcare / MedTech",
    "logistics": "Logistics & Transportation",
    "manufacturing": "Manufacturing & Supply Chain",
    "nonprofit": "Non-Profit & NGO",
    "professional": "Professional Services",
    "public_sector": "Public Sector & Government",
    "real_estate": "Real Estate & Construction",
    "retail": "Retail / Consumer",
    "technology": "Technology",
}

FUNCTION_LABEL = {
    "finance": "Finance & CFO",
    "hr": "HR & Workforce",
    "sales": "Sales & Revenue",
    "supply": "Supply Chain",
    "cx": "Customer Experience",
    "risk": "Risk & Compliance",
    "it": "IT & Platform",
    "rd": "R&D / Innovation",
}

TIER_LABEL = {
    "gen1": "Gen 1 — Automation (RPA)",
    "gen2": "Gen 2 — GenAI",
    "gen3": "Gen 3 — Agentic",
}
