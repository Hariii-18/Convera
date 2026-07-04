import type { WithChildren } from "@/types";

import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

/**
 * Permanent shell for every authenticated route: sidebar + topbar around page content.
 * Route pages render inside `<main>` untouched — no shell concerns leak into them.
 */
export function AppShell({ children }: WithChildren) {
  return (
    <div className="flex min-h-svh w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
