"use client";

import { User } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { initialsFor } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Profile"
        description="Your account information."
      />
      <Card>
        <CardContent>
          {user ? (
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                <AvatarFallback>{initialsFor(user.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {user.full_name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<User />}
              title="No profile data"
              description="Sign in to view your account information."
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
