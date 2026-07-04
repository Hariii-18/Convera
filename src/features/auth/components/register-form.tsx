"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractErrorMessage } from "@/features/auth/error";
import { useRegister } from "@/features/auth/hooks/use-register";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas";

export function RegisterForm() {
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((values) => {
    registerUser.mutate({
      email: values.email,
      full_name: values.full_name,
      password: values.password,
    });
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader>
          <CardTitle as="h1">Create an account</CardTitle>
          <CardDescription>
            Start managing your meetings with Converra.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="full_name"
              className="text-sm font-medium text-foreground"
            >
              Full name
            </label>
            <Input
              id="full_name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              aria-invalid={Boolean(errors.full_name)}
              aria-describedby={
                errors.full_name ? "full_name-error" : undefined
              }
              {...register("full_name")}
            />
            {errors.full_name && (
              <p id="full_name-error" className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirm_password"
              className="text-sm font-medium text-foreground"
            >
              Confirm password
            </label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.confirm_password)}
              aria-describedby={
                errors.confirm_password ? "confirm_password-error" : undefined
              }
              {...register("confirm_password")}
            />
            {errors.confirm_password && (
              <p
                id="confirm_password-error"
                className="text-xs text-destructive"
              >
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          {registerUser.isError && (
            <p className="text-sm text-destructive" role="alert">
              {extractErrorMessage(registerUser.error)}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={registerUser.isPending}
          >
            {registerUser.isPending && (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            )}
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
