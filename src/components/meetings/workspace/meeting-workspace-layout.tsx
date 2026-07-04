import * as React from "react";
import { PanelRight } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  getWorkspaceTabPanelId,
  getWorkspaceTabTriggerId,
  type WorkspaceTabValue,
} from "@/components/meetings/workspace/workspace-tabs";

type MeetingWorkspaceLayoutProps = React.ComponentProps<"div"> & {
  /** Typically a `WorkspaceHeader`. */
  header: React.ReactNode;
  /** Typically a `WorkspaceNavigation`. */
  navigation: React.ReactNode;
  /** The tab `children` renders content for — wires up the tabpanel/tab ARIA relationship. */
  activeTab: WorkspaceTabValue;
  /** Scrollable main content — the active tab's panel. */
  children: React.ReactNode;
  /** Sticky right rail, desktop only. Renders a placeholder when omitted. */
  sidePanel?: React.ReactNode;
};

/**
 * Permanent shell for a single meeting: header, tab navigation, scrollable
 * content, and a sticky info rail on larger screens. Structural only — it
 * never fetches or fabricates meeting data itself.
 */
function MeetingWorkspaceLayout({
  className,
  header,
  navigation,
  activeTab,
  sidePanel,
  children,
  ...props
}: MeetingWorkspaceLayoutProps) {
  return (
    <div
      data-slot="meeting-workspace-layout"
      className={cn("flex flex-1 flex-col", className)}
      {...props}
    >
      <div className="w-full border-b border-border">
        <PageContainer size="wide" className="py-6">
          {header}
        </PageContainer>
      </div>

      {navigation}

      <PageContainer
        size="wide"
        className="grid flex-1 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div
          data-slot="workspace-content"
          role="tabpanel"
          id={getWorkspaceTabPanelId(activeTab)}
          aria-labelledby={getWorkspaceTabTriggerId(activeTab)}
          tabIndex={0}
          className="min-w-0 outline-none"
        >
          {children}
        </div>

        <aside
          data-slot="workspace-info-panel"
          aria-label="Meeting details"
          className="hidden flex-col gap-4 xl:sticky xl:top-[6.5rem] xl:flex"
        >
          {sidePanel ?? (
            <EmptyState
              icon={<PanelRight />}
              title="Nothing here yet"
              description="Participant details, tags, and action items will show up in this panel."
            />
          )}
        </aside>
      </PageContainer>
    </div>
  );
}

export { MeetingWorkspaceLayout };
export type { MeetingWorkspaceLayoutProps };
