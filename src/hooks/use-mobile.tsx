import { useMediaQuery } from "./useMediaQuery";

/**
 * Hook to detect if the current viewport is mobile (less than 768px)
 * Based on Tailwind's default md breakpoint
 */
export function useIsMobile() {
  return useMediaQuery("(max-width: 767px)");
}
