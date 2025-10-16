export function getApiKey(): string | null {
  try {
    // biome-ignore lint/style/useBlockStatements: <>
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("lg:chat:apiKey") ?? null;
  } catch {
    // no-op
  }

  return null;
}
