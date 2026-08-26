"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { formatDate } from "@/components/meetings/format";
import { extractErrorMessage } from "@/features/auth/error";
import { useChangePassword } from "@/features/auth/hooks/use-change-password";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { useUpdateProfile } from "@/features/auth/hooks/use-update-profile";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/features/auth/schemas";
import type { User } from "@/features/auth/types";
import { listTimezones } from "@/lib/timezones";
import { initialsFor } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <PageContainer size="narrow" className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Settings"
        description="Manage your account and application preferences."
      />

      {user ? (
        <>
          <ProfileCard user={user} />
          <PasswordCard />
          <PreferencesCard user={user} />
          <AppearanceCard />
          <SessionCard />
        </>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={<SettingsIcon />}
              title="No account data"
              description="Sign in to manage your settings."
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

function ProfileCard({ user }: { user: User }) {
  const [fullName, setFullName] = React.useState(user.full_name);
  const updateProfile = useUpdateProfile();

  const trimmed = fullName.trim();
  const canSave = trimmed.length > 0 && trimmed !== user.full_name;

  function handleSave() {
    if (!canSave) return;
    updateProfile.mutate(
      { full_name: trimmed },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account details.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initialsFor(user.full_name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            Member since {formatDate(user.created_at, user.timezone)}
          </span>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="full_name"
            className="text-sm font-medium text-foreground"
          >
            Full name
          </label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={255}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input id="email" value={user.email} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            Email address can&apos;t be changed.
          </p>
        </div>

        <div>
          <Button
            onClick={handleSave}
            disabled={!canSave || updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = handleSubmit((values) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        toast.success("Password updated");
        reset();
      },
      onError: (error) =>
        toast.error(extractErrorMessage(error, "Could not update password.")),
    });
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password. You&apos;ll need your current password to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="current_password"
              className="text-sm font-medium text-foreground"
            >
              Current password
            </label>
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.current_password)}
              aria-describedby={
                errors.current_password ? "current_password-error" : undefined
              }
              {...register("current_password")}
            />
            {errors.current_password && (
              <p id="current_password-error" className="text-xs text-destructive">
                {errors.current_password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new_password"
              className="text-sm font-medium text-foreground"
            >
              New password
            </label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.new_password)}
              aria-describedby={
                errors.new_password ? "new_password-error" : undefined
              }
              {...register("new_password")}
            />
            {errors.new_password && (
              <p id="new_password-error" className="text-xs text-destructive">
                {errors.new_password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm_new_password"
              className="text-sm font-medium text-foreground"
            >
              Confirm new password
            </label>
            <Input
              id="confirm_new_password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirm_new_password)}
              aria-describedby={
                errors.confirm_new_password
                  ? "confirm_new_password-error"
                  : undefined
              }
              {...register("confirm_new_password")}
            />
            {errors.confirm_new_password && (
              <p
                id="confirm_new_password-error"
                className="text-xs text-destructive"
              >
                {errors.confirm_new_password.message}
              </p>
            )}
          </div>

          <div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating…" : "Update password"}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function PreferencesCard({ user }: { user: User }) {
  const [timezone, setTimezone] = React.useState(user.timezone);
  const updateProfile = useUpdateProfile();
  const timezones = React.useMemo(() => listTimezones(), []);

  const canSave = timezone !== user.timezone;

  function handleSave() {
    if (!canSave) return;
    updateProfile.mutate(
      { timezone },
      {
        onSuccess: () => toast.success("Timezone updated"),
        onError: (error) => {
          toast.error(extractErrorMessage(error));
          setTimezone(user.timezone);
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Meeting and account dates display in this timezone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone" className="text-sm font-medium text-foreground">
            Timezone
          </label>
          <Select value={timezone} onValueChange={(value) => setTimezone(value as string)}>
            <SelectTrigger id="timezone" aria-label="Select a timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Button
            onClick={handleSave}
            disabled={!canSave || updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how the app looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <span className="text-sm text-muted-foreground">
              Switch between light and dark mode.
            </span>
          </div>
          <ThemeToggle />
        </div>
      </CardContent>
    </Card>
  );
}

function SessionCard() {
  const logout = useLogout();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>Sign out of your account on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={logout}>
          <LogOut data-icon="inline-start" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}
