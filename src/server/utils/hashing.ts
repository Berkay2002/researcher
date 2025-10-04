import { createHash } from "node:crypto";

/**
 * Generate SHA-256 hash from content
 */
export function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generate short hash (first 12 characters) for use in IDs
 */
export function shortHash(content: string): string {
	return hashContent(content).slice(0, 12);
}

/**
 * Check if two pieces of content are identical by comparing hashes
 */
export function contentMatches(content1: string, content2: string): boolean {
	return hashContent(content1) === hashContent(content2);
}
