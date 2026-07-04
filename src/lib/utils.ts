import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared hover treatment for interactive card-shaped surfaces (stat cards,
 * quick action cards, etc). Centralized so the lift/shadow/ring easing stays
 * identical everywhere it's used instead of drifting between copies.
 */
export const hoverLiftClass =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
