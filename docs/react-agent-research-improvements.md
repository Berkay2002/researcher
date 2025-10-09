# React Agent Research Quality Improvements

##**New Features**:
- **Core Responsibilities**: Deep multi-source research, source quality management, comprehensive analysis standards
- **Research Process**: 4-phase approach (landscape mapping, deep dive, gap filling, synthesis)
- **Output Structure**: Executive summary + detailed analysis + key insights + sources
- **Quality Standards**: 
  - Minimum 15-20+ sources
  - 1500-3000+ words for complex topics
  - 10-15+ citations with [Source X] format
  - Multiple dimensions coverage
  - Proper References section in APA format (default) or user-specified format
- **Reference Formatting**: Examples for APA, MLA, Chicago formats with flexibility to adapt
- **Search Strategies**: Detailed examples for health, business, technical topics
- **Tool Usage Patterns**: How to use Tavily vs Exa strategically
- **Critical Prohibitions**: Clear list of what NOT to do
- **Excellence Mindset**: Sets expectations for research-grade outputis document summarizes the comprehensive improvements made to the React ### Expected After**:
- 15-20+ authoritative sources with URLs
- 1500-3000+ words
- 10-15+ [Source X] citations
- Comprehensive coverage:
  - Metabolic effects (detailed)
  - Neurological effects (detailed)
  - Behavioral effects (detailed)
  - General adults analysis
  - Children-specific research
  - Diabetics-specific research
  - FDA position (detailed)
  - WHO position (detailed)
  - IARC classification controversy
  - Historical context (10-year view)
- Structured report with:
  - Executive summary
  - Detailed analysis sections
  - Key insights
  - **References section in proper format (APA default, adapts to user request)**abilities to address quality issues: insufficient sources, inadequate depth, missing citations, and poor structure.

## Problem Analysis

### Original Issues
1. **Weak System Prompt**: 4-line generic prompt with no quality standards
2. **Low Search Limits**: Default 5 results per search (max 20)
3. **No Quality Standards**: No minimum requirements for sources, length, or citations
4. **Missing Guidance**: No instructions for comprehensive, structured reports

### Example of Poor Output
- Only 5 sources (no URLs)
- ~800 words instead of 1500-3000+
- No proper citation format
- Missing comprehensive coverage of dimensions

## Improvements Implemented

### 1. Enhanced Research Subagent System Prompt ✓

**File**: `src/server/agents/react/prompts/research-system.ts`

**Changes**:
- Created comprehensive markdown prompt: `src/server/shared/configs/prompts/research-subagent.system.md`
- Added async loader function to read from markdown (matches pattern from workflows)
- Fallback synchronous prompt with key requirements

**New Prompt Features**:
- **Core Responsibilities**: Deep multi-source research, source quality management, comprehensive analysis standards
- **Research Process**: 4-phase approach (landscape mapping, deep dive, gap filling, synthesis)
- **Output Structure**: Executive summary + detailed analysis + key insights + sources
- **Quality Standards**: 
  - Minimum 15-20+ sources
  - 1500-3000+ words for complex topics
  - 10-15+ citations with [Source X] format
  - Multiple dimensions coverage
- **Search Strategies**: Detailed examples for health, business, technical topics
- **Tool Usage Patterns**: How to use Tavily vs Exa strategically
- **Critical Prohibitions**: Clear list of what NOT to do
- **Excellence Mindset**: Sets expectations for research-grade output

### 2. Increased Search Result Limits ✓

**File**: `src/server/agents/react/tools/search.ts`

**Changes**:
```typescript
// Before
const MAX_SEARCH_RESULTS = 20;
const DEFAULT_SEARCH_RESULTS = 5;

// After
const MAX_SEARCH_RESULTS = 50;
const DEFAULT_SEARCH_RESULTS = 12;
```

**Impact**:
- 2.4x more results per search query (5 → 12)
- 2.5x higher maximum capacity (20 → 50)
- Enables gathering 15-30+ sources across 5-10 queries

### 3. Enhanced Main React Agent System Prompt ✓

**File**: `src/server/agents/react/prompts/system.ts`

**Changes**:
- Comprehensive prompt with clear sections (similar to markdown prompts style)
- Added structured sections using XML-like tags for clarity

**New Features**:
- **Responsibilities**: Clear delegation strategy and quality standards
- **Research Delegation Patterns**: 4 patterns with examples
  1. Comprehensive Analysis
  2. Multi-Dimensional Investigation
  3. Population-Specific Research
  4. Regulatory & Controversy Focus
- **Quality Expectations**: Minimum standards for outputs
- **Reasoning Process**: Step-by-step decision making
- **Execution Guidelines**: DO/DON'T lists with examples

**Impact**:
- Main agent now knows WHEN to delegate to research subagent
- Clear expectations for comprehensive research requests
- Better formulation of research prompts to subagent

### 4. Research Configuration Constants ✓

**File**: `src/server/agents/react/subgraphs/research.ts`

**Changes**:
- Added `RESEARCH_CONFIG` object with configurable quality standards
- All values can be overridden via environment variables

**Configuration**:
```typescript
export const RESEARCH_CONFIG = {
  MIN_SOURCES: 15,              // Minimum distinct sources
  TARGET_SOURCES: 20,           // Target for high quality
  MIN_WORD_COUNT: 1500,         // Minimum report length
  TARGET_WORD_COUNT: 2500,      // Target for detailed analysis
  MIN_CITATIONS: 10,            // Minimum citations in report
  MIN_SEARCH_QUERIES: 5,        // Minimum search queries
  TARGET_SEARCH_QUERIES: 8,     // Target for thorough coverage
  RESULTS_PER_QUERY: 12,        // Max results per query
};
```

**Benefits**:
- Clear quality standards documented in code
- Environment variable configuration for easy tuning
- Can be referenced in validation or monitoring logic

## Files Modified

1. ✓ `src/server/agents/react/prompts/research-system.ts` - Research subagent prompt
2. ✓ `src/server/shared/configs/prompts/research-subagent.system.md` - New markdown prompt
3. ✓ `src/server/agents/react/prompts/system.ts` - Main agent orchestration prompt
4. ✓ `src/server/agents/react/tools/search.ts` - Search result limits
5. ✓ `src/server/agents/react/subgraphs/research.ts` - Configuration constants

## Expected Improvements

### For Aspartame Example Query

**Before**:
- 5 sources (no URLs)
- ~800 words
- No proper citations
- Missing regulatory details
- No specific population analysis

**Expected After**:
- 15-20+ authoritative sources with URLs
- 1500-3000+ words
- 10-15+ [Source X] citations
- Comprehensive coverage:
  - Metabolic effects (detailed)
  - Neurological effects (detailed)
  - Behavioral effects (detailed)
  - General adults analysis
  - Children-specific research
  - Diabetics-specific research
  - FDA position (detailed)
  - WHO position (detailed)
  - IARC classification controversy
  - Historical context (10-year view)
- Structured report with:
  - Executive summary
  - Detailed analysis sections
  - Key insights
  - Complete source list with URLs

### Process Improvements

1. **More Searches**: 5-10 diverse queries instead of 1-2
2. **More Sources Per Search**: 12 results instead of 5
3. **Better Search Strategy**: Mix of Tavily (news/general) and Exa (semantic/technical)
4. **Comprehensive Synthesis**: Integration across sources, not just listing
5. **Proper Structure**: Clear sections, headings, logical flow
6. **Full Citations**: [Source X] format with URLs and excerpts

## Environment Variables (Optional Tuning)

If you need to adjust quality standards:

```bash
# Minimum requirements
RESEARCH_MIN_SOURCES=15
RESEARCH_MIN_WORD_COUNT=1500
RESEARCH_MIN_CITATIONS=10
RESEARCH_MIN_QUERIES=5

# Target goals
RESEARCH_TARGET_SOURCES=20
RESEARCH_TARGET_WORD_COUNT=2500
RESEARCH_TARGET_QUERIES=8
RESEARCH_RESULTS_PER_QUERY=12
```

## Testing Recommendations

1. **Test with original query**: Run the aspartame query again
2. **Verify source count**: Should have 15-20+ sources
3. **Check word count**: Should be 1500+ words
4. **Validate citations**: Should use [Source X] format with URLs
5. **Assess structure**: Should have clear sections and executive summary
6. **Review coverage**: Should address all dimensions (metabolic, neurological, behavioral, populations, regulatory)

## Additional Notes

### Markdown Prompt Pattern
Following the established pattern from workflows:
- Prompts stored in `src/server/shared/configs/prompts/`
- Loaded via `fs.readFile` with caching
- Structured with XML-like tags for clarity
- Comprehensive instructions with examples

### Quality Philosophy
The improvements shift from:
- **Quantity over quality** → **Quality with depth**
- **Quick answers** → **Research-grade reports**
- **Single source** → **Multi-source synthesis**
- **Bullet points** → **Comprehensive paragraphs**
- **No citations** → **Rigorous attribution**

### Compatibility
- Backward compatible (synchronous prompt still available)
- No breaking changes to existing interfaces
- Environment variables optional (sensible defaults)
- Can gradually adopt markdown prompt loading

## Next Steps

1. **Test the improvements** with comprehensive research queries
2. **Monitor agent behavior** - does it execute 5-10 searches?
3. **Review output quality** - sources, length, citations, structure
4. **Fine-tune if needed** via environment variables
5. **Consider adding** output validation based on RESEARCH_CONFIG constants
6. **Track metrics**: source count, word count, citation count per research task

## Success Criteria

The React agent research quality is considered successful when:
- ✓ Research reports contain 15-20+ authoritative sources
- ✓ Reports are 1500-3000+ words for comprehensive topics
- ✓ All factual claims have [Source X] citations with URLs
- ✓ Reports cover all major dimensions of the topic
- ✓ Structure includes executive summary + detailed analysis + insights
- ✓ Agent executes 5-10 diverse search queries
- ✓ Both Tavily and Exa are used strategically
- ✓ Output matches quality of workflow-based research agents
