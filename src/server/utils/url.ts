/**
 * Normalize URL for deduplication
 * - Remove trailing slashes
 * - Convert to lowercase
 * - Remove www prefix
 * - Sort query parameters
 * - Remove common tracking parameters
 */
export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);

		// Remove www prefix
		let hostname = parsed.hostname;
		if (hostname.startsWith("www.")) {
			hostname = hostname.slice(4);
		}

		// Sort query parameters and remove tracking params
		const trackingParams = new Set([
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
			"fbclid",
			"gclid",
			"mc_cid",
			"mc_eid",
		]);

		const params = new URLSearchParams(parsed.search);
		const sortedParams = new URLSearchParams();

		// biome-ignore lint/complexity/noForEach: URLSearchParams iteration
		params.forEach((value, key) => {
			if (!trackingParams.has(key)) {
				sortedParams.append(key, value);
			}
		});

		// Sort params alphabetically
		sortedParams.sort();

		// Remove trailing slash from pathname
		let pathname = parsed.pathname;
		if (pathname.endsWith("/") && pathname.length > 1) {
			pathname = pathname.slice(0, -1);
		}

		// Reconstruct URL
		const normalized = `${parsed.protocol}//${hostname}${pathname}`;
		const query = sortedParams.toString();

		return query ? `${normalized}?${query}` : normalized;
	} catch {
		// If URL parsing fails, return original
		return url;
	}
}

/**
 * Validate if string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string | null {
	try {
		const parsed = new URL(url);
		return parsed.hostname;
	} catch {
		return null;
	}
}

/**
 * Check if URL is likely a robots.txt URL
 */
export function getRobotsTxtUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.hostname}/robots.txt`;
	} catch {
		return null;
	}
}
