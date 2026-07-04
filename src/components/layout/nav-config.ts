import {
  CalendarDays,
  Download,
  LayoutDashboard,
  Radio,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * Primary sidebar navigation. Extend as feature areas land under `(app)/*`.
 */
export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Meetings", href: "/meetings", icon: CalendarDays },
  { label: "Live Meeting", href: "/live", icon: Radio },
  { label: "Downloads", href: "/downloads", icon: Download },
  { label: "Search", href: "/search", icon: Search },
  { label: "Settings", href: "/settings", icon: Settings },
];
