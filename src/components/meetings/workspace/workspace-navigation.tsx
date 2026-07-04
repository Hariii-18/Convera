"use client";

import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getWorkspaceTabPanelId,
  getWorkspaceTabTriggerId,
  workspaceTabs,
  type WorkspaceTabValue,
} from "@/components/meetings/workspace/workspace-tabs";

type WorkspaceNavigationProps = React.ComponentProps<"div"> & {
  value: WorkspaceTabValue;
  onValueChange?: (value: WorkspaceTabValue) => void;
};

/**
 * Sticky tab bar for the meeting workspace. Purely navigational — it never
 * renders tab content, so the same bar works regardless of how (or whether)
 * a consumer wires it up to routing.
 */
function WorkspaceNavigation({
  className,
  value,
  onValueChange,
  ...props
}: WorkspaceNavigationProps) {
  return (
    <div
      data-slot="workspace-navigation"
      className={cn(
        "sticky top-14 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      {...props}
    >
      <PageContainer size="wide" className="py-0">
        <Tabs
          value={value}
          onValueChange={(next) => onValueChange?.(next as WorkspaceTabValue)}
        >
          <TabsList>
            {workspaceTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                id={getWorkspaceTabTriggerId(tab.value)}
                aria-controls={getWorkspaceTabPanelId(tab.value)}
              >
                <tab.icon aria-hidden="true" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageContainer>
    </div>
  );
}

export { WorkspaceNavigation };
export type { WorkspaceNavigationProps };
