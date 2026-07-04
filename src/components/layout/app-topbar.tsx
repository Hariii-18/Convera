"use client";

import { PanelLeft } from "lucide-react";

import { GlobalSearch } from "@/components/shared/global-search";
import { NotificationButton } from "@/components/shared/notification-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserNav } from "@/components/shared/user-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/store/ui-store";

import { APP_SIDEBAR_ID } from "./app-sidebar";
import { Breadcrumbs } from "./breadcrumbs";

export function AppTopbar() {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        aria-expanded={isSidebarOpen}
        aria-controls={APP_SIDEBAR_ID}
      >
        <PanelLeft className="size-4" />
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumbs className="hidden flex-1 lg:flex" />
      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        <NotificationButton />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserNav />
      </div>
    </header>
  );
}
