# React Agent Research Quality Standards

## Quick Reference

### Adaptive Quality Standards (Agent Scales Based on Needs)

| Metric | Simple/Focused | Standard Comprehensive | Deep Analysis | Very Complex | Notes |
|--------|----------------|------------------------|---------------|--------------|-------|
| **Sources** | 10-15 | 20-30 | 30-40 | 40-60+ | Scale to topic complexity |
| **Word Count** | 800-1,500 | 2,000-4,000 | 4,000-6,000 | 6,000-10,000+ | Match depth to request |
| **Citations** | 8-12 | 15-20 | 25-30 | 30-50+ | [Source X] format with URLs |
| **Search Queries** | 3-5 | 8-10 | 12-15 | 15-20+ | Diverse queries covering all aspects |
| **Results/Query** | 10-12 | 12-15 | 15+ | 15-20+ | Balanced between depth and breadth |

**Important**: These are guidelines, not rigid limits. The agent adapts based on:
- Topic complexity and scope
- Number of dimensions to cover
- User's explicit requests ("very detailed", "brief overview", etc.)
- Available source quality and quantity
- Depth needed to answer the question thoroughly

**Word Count Philosophy**:
- **Brief/Quick**: 800-1,500 words when user wants concise answers
- **Standard**: 2,000-4,000 words for typical comprehensive research
- **Detailed**: 4,000-6,000 words when user requests "very detailed" or "in-depth"
- **Extensive**: 6,000-10,000+ words for highly complex, multi-dimensional topics
- **No Artificial Caps**: If a topic legitimately needs 12,000 words and 50 sources, the agent should provide that

### Research Process Phases

1. **Landscape Mapping** (2-3 searches)
   - Broad overview queries
   - Identify major dimensions
   - Understand scope and controversies

2. **Deep Dive** (4-6 searches)
   - Targeted queries per dimension
   - Technical/scientific details
   - Regulatory positions
   - Population-specific research
   - Controversies and debates

3. **Gap Filling** (1-3 searches)
   - Address remaining gaps
   - Verify critical claims
   - Find authoritative summaries

4. **Synthesis**
   - Executive summary
   - Detailed structured analysis
   - Key insights
   - Complete source list

### Output Structure

```
Executive Summary (150-300 words)
├── Brief overview
├── 2-3 key findings
└── Main conclusions

Main Analysis (1500-2500+ words)
├── Introduction & Context
├── [Dimension 1] (200-400 words)
│   ├── Evidence from multiple sources
│   ├── Citations [Source X]
│   └── Analysis and interpretation
├── [Dimension 2] (200-400 words)
├── [Dimension 3] (200-400 words)
└── [Additional dimensions as needed]

Key Insights & Implications
├── Major takeaways
├── Practical implications
└── Areas for further research

References (Properly Formatted)
├── [Source 1]: APA/MLA/Chicago format with full citation
├── [Source 2]: Complete bibliographic information
└── [Continue for all sources, numbered to match in-text citations]
```

### Tool Usage Strategy

| Tool | Use For | Example Query |
|------|---------|---------------|
| **tavily_search** | General web, news, recent developments | "aspartame FDA WHO 2023 2024 safety" |
| **exa_search** | Semantic search, technical content | "aspartame metabolic effects mechanism research" |
| **Both** | Comprehensive coverage | Use Tavily for news/general, Exa for depth |

### Source Quality Priorities

1. **Primary Priority** (.edu, .gov, peer-reviewed)
   - Academic institutions
   - Government agencies
   - Peer-reviewed journals
   - Official regulatory bodies

2. **Secondary Priority** (reputable media/industry)
   - Major news outlets (Reuters, WSJ, FT)
   - Industry reports
   - Professional associations
   - Expert blogs/commentary

3. **Temporal Balance**
   - Current topics: 70% last 1-3 years
   - Historical context: 30% older sources
   - Always note publication dates

### Citation Format

**Inline Citations**:
```
According to the FDA [Source 3], aspartame is safe for general consumption...

The WHO's IARC classified aspartame as "possibly carcinogenic" [Source 5], but 
JECFA maintained the acceptable daily intake [Source 6].
```

**References Section** (Choose appropriate format):

**APA Format (Default)**:
```
References

[Source 3] U.S. Food and Drug Administration. (2023). Aspartame and Other Sweeteners in Food. https://www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food

[Source 5] World Health Organization. (2023). Aspartame hazard and risk assessment results released. https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment

[Source 6] Smith, J., & Johnson, M. (2024). Metabolic effects of artificial sweeteners: A systematic review. Journal of Nutrition, 154(3), 412-428. https://doi.org/10.1093/jn/nxab123
```

**MLA Format (If user requests)**:
```
Works Cited

[Source 3] U.S. Food and Drug Administration. "Aspartame and Other Sweeteners in Food." FDA, 2023, www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food.

[Source 5] World Health Organization. "Aspartame Hazard and Risk Assessment Results Released." WHO, 14 July 2023, www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment.
```

**Chicago Format (If user requests)**:
```
Bibliography

[Source 3] U.S. Food and Drug Administration. "Aspartame and Other Sweeteners in Food." 2023. https://www.fda.gov/food/food-additives-petitions/aspartame-and-other-sweeteners-food.

[Source 5] World Health Organization. "Aspartame Hazard and Risk Assessment Results Released." July 14, 2023. https://www.who.int/news/item/14-07-2023-aspartame-hazard-and-risk-assessment.
```

**Important**: The agent adapts format based on:
- User's explicit request ("use MLA format", "Chicago style citations")
- Academic context (educational research often uses APA)
- Default to APA if no preference specified

### Red Flags (Quality Issues)

 **Insufficient Research**
- Fewer than 5 search queries executed
- Fewer than 15 sources gathered
- Only 1-2 perspectives covered

 **Poor Synthesis**
- Report shorter than 1,500 words (for comprehensive topics)
- Bullet points instead of paragraphs
- Source-by-source listing instead of integration

 **Citation Problems**
- Fewer than 10 citations
- No URLs provided for sources
- Vague references ("studies show...")
- Missing [Source X] format

 **Structure Issues**
- No executive summary
- No clear sections/headings
- Missing key dimensions
- Unbalanced coverage

### Environment Variable Overrides

```bash
# Adjust in .env or .env.local
RESEARCH_MIN_SOURCES=15
RESEARCH_TARGET_SOURCES=20
RESEARCH_MIN_WORD_COUNT=1500
RESEARCH_TARGET_WORD_COUNT=2500
RESEARCH_MIN_CITATIONS=10
RESEARCH_MIN_QUERIES=5
RESEARCH_TARGET_QUERIES=8
RESEARCH_RESULTS_PER_QUERY=12
```

### Success Checklist

Before completing research, verify:

- [ ] Executed 5-10 diverse search queries
- [ ] Used both Tavily and Exa strategically
- [ ] Gathered 15-20+ authoritative sources
- [ ] Report is 1,500+ words (for comprehensive topics)
- [ ] Included executive summary (150-300 words)
- [ ] Created clear section structure
- [ ] Covered all major dimensions
- [ ] Included 10-15+ [Source X] citations
- [ ] Provided URLs for all sources
- [ ] Created References section with proper formatting
- [ ] Used appropriate citation format (APA default or user-specified)
- [ ] References match [Source X] numbering in text
- [ ] Presented balanced perspectives
- [ ] Addressed controversies/debates
- [ ] Included publication dates/context
- [ ] Synthesized across sources (not listed)
