import * as React from "react";

import { SectionHeader } from "@/components/layout/section-header";
import { cn } from "@/lib/utils";
import { StatCard, type StatCardProps } from "@/components/ui/stat-card";

export type StatItem = Omit<StatCardProps, "className">;

type StatisticsGridProps = Omit<React.ComponentProps<"div">, "title"> & {
  stats: StatItem[];
  title?: string;
  description?: string;
};

function StatisticsGrid({
  className,
  stats,
  title = "Overview",
  description,
  ...props
}: StatisticsGridProps) {
  return (
    <section
      data-slot="statistics-grid"
      aria-labelledby="statistics-grid-heading"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <SectionHeader
        title={title}
        description={description}
        headingId="statistics-grid-heading"
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    </section>
  );
}

export { StatisticsGrid };
