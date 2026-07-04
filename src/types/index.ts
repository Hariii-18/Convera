import type { ReactNode } from "react";

/**
 * Global, domain-agnostic type helpers shared across the app.
 * Feature-specific types belong inside their own `features/*` module.
 */

export type Nullable<T> = T | null;

export type Maybe<T> = T | null | undefined;

export type WithChildren<T = unknown> = T & {
  children: ReactNode;
};

export type WithClassName<T = unknown> = T & {
  className?: string;
};
