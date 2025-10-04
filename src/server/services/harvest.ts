import type { Evidence, SearchResult } from "../graph/state";
import { hashContent } from "../utils/hashing";
import { chunkText } from "../utils/text";
import { getRobotsTxtUrl, isValidUrl } from "../utils/url";

/**
 * Harvest options
 */
export interface HarvestOptions {
	/** Maximum time to wait for fetch (ms) */
	timeout?: number;
	/** User agent string */
	userAgent?: string;
	/** Whether to respect robots.txt */
	respectRobotsTxt?: boolean;
}

/**
 * Harvest full content from search results
 */
export async function harvestResults(
	results: SearchResult[],
	options: HarvestOptions = {}
): Promise<Evidence[]> {
	const {
		timeout = 10000,
		userAgent = "ResearchAssistant/1.0 (Educational)",
		respectRobotsTxt = true,
	} = options;

	// Harvest in parallel with Promise.allSettled to handle failures gracefully
	const harvested = await Promise.allSettled(
		results.map((result) =>
			harvestSingle(result, { timeout, userAgent, respectRobotsTxt })
		)
	);

	// Filter successful harvests
	const evidence: Evidence[] = [];
	for (const result of harvested) {
		if (result.status === "fulfilled" && result.value !== null) {
			evidence.push(result.value);
		}
	}

	return evidence;
}

/**
 * Harvest single URL
 */
async function harvestSingle(
	result: SearchResult,
	options: Required<HarvestOptions>
): Promise<Evidence | null> {
	const { url, title, snippet, source } = result;

	// Validate URL
	if (!isValidUrl(url)) {
		return null;
	}

	// Check robots.txt if enabled
	if (options.respectRobotsTxt) {
		const allowed = await checkRobotsTxt(url, options.userAgent);
		if (!allowed) {
			return null;
		}
	}

	// Fetch content with timeout
	const content = await fetchWithTimeout(url, options.timeout, options.userAgent);
	if (!content) {
		return null;
	}

	// Extract text content
	const text = extractTextContent(content);
	if (!text || text.length < 100) {
		// Skip if too little content
		return null;
	}

	// Generate content hash
	const contentHash = hashContent(text);

	// Chunk the text
	const chunks = chunkText(text, {
		maxChunkSize: 1000,
		overlapSize: 100,
	});

	return {
		url,
		title,
		snippet,
		contentHash,
		chunks,
		source,
	};
}

/**
 * Fetch URL content with timeout
 */
async function fetchWithTimeout(
	url: string,
	timeout: number,
	userAgent: string
): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			headers: {
				"User-Agent": userAgent,
			},
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return null;
		}

		// Check content type
		const contentType = response.headers.get("content-type") || "";
		if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
			return null;
		}

		return await response.text();
	} catch (error) {
		// Handle timeout, network errors, etc.
		return null;
	}
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html: string): string {
	// Simple HTML tag removal (for production, use a proper HTML parser)
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Check robots.txt for URL allowance
 */
async function checkRobotsTxt(
	url: string,
	userAgent: string
): Promise<boolean> {
	try {
		const robotsTxtUrl = getRobotsTxtUrl(url);
		if (!robotsTxtUrl) {
			return true; // Allow if can't determine robots.txt URL
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(robotsTxtUrl, {
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return true; // Allow if robots.txt doesn't exist
		}

		const robotsTxt = await response.text();

		// Simple robots.txt parser - look for Disallow directives
		// For production, use a proper robots.txt parser library
		const lines = robotsTxt.split("\n");
		let relevantSection = false;

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed.startsWith("User-agent:")) {
				const agent = trimmed.slice(11).trim();
				relevantSection = agent === "*" || agent === userAgent;
			}

			if (relevantSection && trimmed.startsWith("Disallow:")) {
				const path = trimmed.slice(9).trim();
				if (path === "/" || url.includes(path)) {
					return false; // Disallowed
				}
			}
		}

		return true; // Allowed
	} catch {
		return true; // Allow on error
	}
}
