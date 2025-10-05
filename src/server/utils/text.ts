import type { Chunk } from "../graph/state";

/**
 * Text chunking options
 */
export type ChunkOptions = {
  /** Maximum characters per chunk */
  maxChunkSize?: number;
  /** Characters to overlap between chunks */
  overlapSize?: number;
  /** Separator to split on (defaults to paragraph breaks) */
  separator?: string;
};

// Default chunking parameters
export const MAX_CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP_SIZE = 100;
export const MIN_CONTENT_LENGTH = 200;

// Excerpt extraction parameters
export const DEFAULT_EXCERPT_LENGTH = 300;
export const MAX_EXCERPT_LENGTH = 1000;
export const MIN_KEYWORD_LENGTH = 3;
export const MAX_KEYWORDS = 10;
export const MIN_KEYWORD_SCORE = 2;
export const TITLE_TRUNCATION_LENGTH = 100;
export const EXCERPT_SUBSTRING_LENGTH = 20;
export const ELLIPSIS_LENGTH = 3;

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const {
    maxChunkSize = 1000,
    overlapSize = 100,
    separator = "\n\n",
  } = options;

  // Clean and normalize text
  const cleaned = cleanText(text);

  // Split on separator first
  const paragraphs = cleaned.split(separator).filter((p) => p.trim());

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max size, finalize current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + paragraph.length + separator.length > maxChunkSize
    ) {
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
      });

      // Start new chunk with overlap from previous chunk
      const overlap = getOverlap(currentChunk, overlapSize);
      currentChunk = overlap ? `${overlap}${separator}${paragraph}` : paragraph;
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk
        ? `${currentChunk}${separator}${paragraph}`
        : paragraph;
    }
  }

  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex++,
    });
  }

  return chunks;
}

/**
 * Get last N characters from text for overlap
 */
function getOverlap(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) {
    return text;
  }
  return text.slice(-overlapSize);
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove excessive newlines
      .replace(/\n{3,}/g, "\n\n")
      // Remove excessive spaces
      .replace(/ {2,}/g, " ")
      // Trim
      .trim()
  );
}

/**
 * Truncate text to maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - ELLIPSIS_LENGTH)}...`;
}

/**
 * Extract text excerpt around a search term
 */
export function extractExcerpt(
  text: string,
  searchTerm: string,
  contextLength = 200
): string {
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) {
    return truncateText(text, contextLength * 2);
  }

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + searchTerm.length + contextLength);

  let excerpt = text.slice(start, end);

  if (start > 0) {
    excerpt = `...${excerpt}`;
  }
  if (end < text.length) {
    excerpt = `${excerpt}...`;
  }

  return excerpt;
}
