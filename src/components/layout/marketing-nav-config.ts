export type MarketingNavItem = {
  label: string;
  /** Omit for links that are placeholders and not yet wired up to a route. */
  href?: string;
};

export const marketingNavItems: MarketingNavItem[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing" },
  { label: "Docs" },
];
