import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ensureAbsoluteUrl(url: string): string {
  if (url.startsWith("/") && typeof window !== "undefined") {
    return new URL(url, window.location.origin).toString();
  }
  return url;
}
