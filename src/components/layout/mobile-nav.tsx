"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { marketingNavItems } from "@/components/layout/marketing-nav-config";

export function MobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="md:hidden"
          />
        }
      >
        <Menu className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {marketingNavItems.map((item) =>
          item.href ? (
            <DropdownMenuItem
              key={item.label}
              render={<Link href={item.href} />}
            >
              {item.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={item.label} disabled>
              {item.label}
            </DropdownMenuItem>
          ),
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/login" />}>
          Sign in
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
