"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Search"
        description="Find meetings, transcripts, and summaries across your workspace."
      />
      <Card>
        <CardContent className="flex flex-col gap-6">
          <SearchInput
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            className="max-w-md"
          />
          <EmptyState
            icon={<Search />}
            title={
              query ? `No results for "${query}"` : "Start typing to search"
            }
            description="Search results will appear here once this feature is connected."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
