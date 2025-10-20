# Source Link Preservation Fix

## Problem

Source URLs in the final report were frequently broken ("page not found") because URLs were being passed through LLM compression and summarization, causing corruption, truncation, or loss.

## Root Cause

The previous flow was:

1. Research agents fetch sources → URLs embedded in text
2. Text passed to compression LLM → **URLs get corrupted**
3. Regex extraction from corrupted text → Broken links in final report

## Solution

Implemented a **structured source tracking system** that bypasses LLM processing for URLs:

### 1. **Added SourceMetadata Type** (`state.ts`)

```typescript
export type SourceMetadata = {
  url: string; // Original URL (never modified)
  title: string; // Source title
  query?: string; // Optional: search query that found it
};
```

### 2. **Added `sources` Field to All State Levels**

- **ResearcherState**: Collects sources from tool messages
- **SupervisorState**: Aggregates sources from all researchers
- **AgentState**: Passes sources to final report generation

### 3. **Extract Sources BEFORE Compression** (`compress-research.ts`)

```typescript
// Parse ToolMessages to extract pristine URLs
for (const msg of researcher_messages) {
  if (ToolMessage.isInstance(msg)) {
    // Extract sources from: --- SOURCE 1: Title ---\nURL: https://...
    sources.push({ url, title });
  }
}

// Compress only the text content (not sources)
const compressedResearch = await compressionModel.invoke(...);

return {
  compressed_research: compressedResearch,  // Text only
  sources,                                   // Pristine URLs
};
```

### 4. **Aggregate Sources Through State** (`supervisor-tools.ts`)

```typescript
// Collect sources from all parallel researchers
const allSources = results.flatMap((r) => r.sources);

return {
  notes,
  sources: allSources, // Pass pristine sources to parent
};
```

### 5. **Append Sources Section** (`final-report-generation.ts`)

```typescript
// Generate report content
const response = await agent.invoke(...);

// Append structured sources with guaranteed-correct URLs
if (state.sources && state.sources.length > 0) {
  finalReportContent += "\n\n### Sources\n\n";
  for (const [index, source] of state.sources.entries()) {
    const citationNum = index + 1;
    finalReportContent += `- [${citationNum}] ${source.title}: ${source.url}\n`;
  }
}
```

### 6. **Updated Prompts** (`prompts.ts`)

- **Compression prompt**: No longer asks LLM to create Sources section
- **Final report prompt**: Clarifies sources will be appended automatically
- LLMs only handle inline citation numbers `[1]`, `[2]`, etc.

## Data Flow

```
Tavily Search Tool
  └─> ToolMessage with "--- SOURCE 1: Title ---\nURL: https://..."
        └─> compress-research.ts extracts pristine URLs
              └─> ResearcherState.sources: [{ url, title }]
                    └─> supervisor-tools.ts aggregates
                          └─> SupervisorState.sources: [...]
                                └─> AgentState.sources: [...]
                                      └─> final-report-generation.ts
                                            └─> Appends "### Sources" with correct URLs
```

## Benefits

✅ **No URL corruption**: URLs never pass through LLM processing  
✅ **Single source of truth**: Extracted once from tool messages  
✅ **Guaranteed accuracy**: Final report uses pristine URLs from state  
✅ **Clean separation**: Text compression ≠ Source tracking  
✅ **Backwards compatible**: Existing citation format `[1]`, `[2]` still works

## Testing

To verify the fix:

1. Run a research query that generates multiple sources
2. Check the final report's "### Sources" section
3. Verify all URLs are valid and clickable
4. Compare with previous broken links

## Files Modified

1. `src/server/workflows/deep-research/graph/state.ts`

   - Added `SourceMetadata` type
   - Added `sources` field to ResearcherState, SupervisorState, AgentState, ResearcherOutputState

2. `src/server/workflows/deep-research/graph/subgraphs/researcher/nodes/compress-research.ts`

   - Extract sources from ToolMessages before compression
   - Return structured sources alongside compressed text

3. `src/server/workflows/deep-research/graph/subgraphs/supervisor/nodes/supervisor-tools.ts`

   - Aggregate sources from all researchers
   - Pass to parent state

4. `src/server/workflows/deep-research/graph/nodes/final-report-generation.ts`

   - Use structured sources from state
   - Append Sources section with pristine URLs

5. `src/server/workflows/deep-research/prompts.ts`
   - Updated compression prompt (no Sources section)
   - Updated final report prompt (sources handled automatically)

## Future Enhancements

- Add source deduplication (same URL from multiple researchers)
- Track which researcher found each source
- Add source metadata (date accessed, query used)
- Support source filtering by relevance
