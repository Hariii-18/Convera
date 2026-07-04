"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SearchInput } from "@/components/ui/search-input";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Search"
            className="w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56 sm:px-2.5"
          />
        }
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search across your workspace</DialogDescription>
        </DialogHeader>
        <SearchInput
          autoFocus
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
        />
        <p
          role="status"
          aria-live="polite"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {query ? `No results for "${query}"` : "Start typing to search."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
