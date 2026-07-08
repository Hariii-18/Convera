"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUiStore } from "@/store/ui-store";

import type { NavItem } from "./nav-config";

type SidebarNavItemProps = {
  item: NavItem;
  collapsed?: boolean;
};

export function SidebarNavItem({
  item,
  collapsed = false,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  // Below the `lg` breakpoint the sidebar is a drawer overlaying the page, so
  // a nav click should close it; on desktop it's pinned in the layout and
  // should stay exactly as the user left it (open/collapsed).
  const isBelowDesktop = useMediaQuery("(max-width: 1023px)");
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const handleNavigate = () => {
    if (isBelowDesktop) setSidebarOpen(false);
  };

  const linkClassName = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
    collapsed && "justify-center px-0",
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={linkClassName}
              onClick={handleNavigate}
            />
          }
        >
          <Icon className="size-4 shrink-0" />
          <span className="sr-only">{item.label}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={linkClassName}
      onClick={handleNavigate}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
