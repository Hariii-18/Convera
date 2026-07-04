"use client";

import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type SearchInputProps = React.ComponentProps<"input"> & {
  containerClassName?: string;
  /** Called when the clear button is pressed. Omit to hide the clear button. */
  onClear?: () => void;
};

function SearchInput({
  className,
  containerClassName,
  value,
  onClear,
  placeholder = "Search…",
  ...props
}: SearchInputProps) {
  const hasValue =
    typeof value === "string" ? value.length > 0 : Boolean(value);

  return (
    <div
      data-slot="search-input"
      className={cn("relative w-full", containerClassName)}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        className={cn(
          "pl-8 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          hasValue && onClear && "pr-8",
          className,
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
