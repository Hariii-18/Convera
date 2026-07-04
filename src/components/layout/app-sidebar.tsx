"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

import { navItems } from "./nav-config";
import { SidebarNavItem } from "./sidebar-nav-item";

export const APP_SIDEBAR_ID = "app-sidebar";

export function AppSidebar() {
  const isOpen = useUiStore((state) => state.isSidebarOpen);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  const collapsed = !isOpen;
  const asideRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // `isSidebarOpen` defaults to true so desktop renders expanded on first
  // paint with no hydration mismatch. Below the `lg` breakpoint that same
  // default would show the drawer open over a dark backdrop, so close it
  // once we can read the real viewport on the client.
  const isBelowDesktop = useMediaQuery("(max-width: 1023px)");
  useEffect(() => {
    if (isBelowDesktop) setOpen(false);
  }, [isBelowDesktop, setOpen]);

  // Mobile drawer behavior: trap focus inside while open, close on Escape,
  // and return focus to whatever opened it once it closes.
  useEffect(() => {
    if (!isBelowDesktop) return;

    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const firstFocusable = asideRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      firstFocusable?.focus();

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      }
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }

    previousFocusRef.current?.focus();
  }, [isOpen, isBelowDesktop, setOpen]);

  return (
    <>
      {/* Backdrop: mobile-only, closes the drawer on outside click. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        ref={asideRef}
        id={APP_SIDEBAR_ID}
        data-slot="app-sidebar"
        role={isBelowDesktop ? "dialog" : undefined}
        aria-modal={isBelowDesktop && isOpen ? true : undefined}
        aria-label={isBelowDesktop ? "Sidebar navigation" : undefined}
        inert={isBelowDesktop && !isOpen ? true : undefined}
        style={
          { "--sidebar-width": collapsed ? "4.5rem" : "16rem" } as CSSProperties
        }
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-svh w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out",
          "lg:sticky lg:top-0 lg:z-0 lg:w-(--sidebar-width) lg:translate-x-0 lg:transition-[width]",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
          <Logo iconOnly={collapsed} className="text-sidebar-foreground" />
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="hidden shrink-0 border-t border-sidebar-border p-3 lg:block">
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={() => setOpen(!isOpen)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={isOpen}
            aria-controls={APP_SIDEBAR_ID}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}
