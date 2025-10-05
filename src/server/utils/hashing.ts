import { createHash } from "node:crypto";

// Hash constants
export const SHORT_HASH_LENGTH = 12;
export const UTF8_ENCODING = "utf8";
export const SHA256_ALGORITHM = "sha256";

/**
 * Generate SHA-256 hash from content
 */
export function hashContent(content: string): string {
	return createHash(SHA256_ALGORITHM).update(content, UTF8_ENCODING).digest("hex");
}

/**
 * Generate short hash (first 12 characters) for use in IDs
 */
export function shortHash(content: string): string {
	return hashContent(content).slice(0, SHORT_HASH_LENGTH);
}

/**
 * Check if two pieces of content are identical by comparing hashes
 */
export function contentMatches(content1: string, content2: string): boolean {
	return hashContent(content1) === hashContent(content2);
}
