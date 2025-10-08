/**
 * LangGraph SDK Proxy Route
 *
 * Forwards requests from the frontend to the LangGraph server.
 * Based on the example provided, but simplified without authentication.
 */

import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Pre-define regex to avoid performance issues
const TRAILING_SLASH_REGEX = /\/+$/;

type Params = {
  params: Promise<{
    _path?: string[];
  }>;
};

// Headers that are allowed to be forwarded
const ALLOWED_REQUEST_HEADERS = new Set([
  "content-type",
  "accept",
  "x-requested-with",
]);

// Headers that should not be forwarded for security
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
  "host",
]);

/**
 * Proxy function that forwards requests to the LangGraph server
 */
async function proxy(request: NextRequest, props: Params) {
  const env = process.env;
  const rawBaseUrl = env.LANGGRAPH_API_URL;

  if (!rawBaseUrl) {
    return NextResponse.json(
      { error: "LANGGRAPH_API_URL environment variable is not set" },
      { status: 500 }
    );
  }

  const params = await props.params;
  const { _path = [] } = params;

  // Normalize the base URL and construct the target URL
  const normalizedBaseUrl = rawBaseUrl.replace(TRAILING_SLASH_REGEX, "");
  const pathname = _path.map(encodeURIComponent).join("/");
  const targetUrl = new URL(
    `${pathname}${request.nextUrl.search}`,
    `${normalizedBaseUrl}/`
  );

  // Forward allowed headers
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) {
      continue;
    }
    if (ALLOWED_REQUEST_HEADERS.has(lower)) {
      forwardHeaders.set(key, value);
    }
  }

  // Set up request options
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
    signal: request.signal,
  };

  // Forward request body if present
  if (request.body) {
    init.body = request.body as ReadableStream;
    init.duplex = "half";
  }

  try {
    // Make the request to the LangGraph server
    const response = await fetch(targetUrl.href, init);

    // Clean up response headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("transfer-encoding");
    responseHeaders.delete("set-cookie");
    responseHeaders.delete("cookie");

    // Return the response from the LangGraph server
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    // Log error for debugging
    // eslint-disable-next-line no-console
    // Log error for debugging - using a proper logging approach
    // In production, you might want to use a proper logging service
    if (process.env.NODE_ENV === "development") {
      // biome-ignore lint/suspicious/noConsole: <Logging>
      console.error("LangGraph proxy fetch failed:", err);
    }
    return NextResponse.json(
      { error: "Failed to reach LangGraph server" },
      { status: 502 }
    );
  }
}

// Export for all HTTP methods
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
  proxy as HEAD,
};
