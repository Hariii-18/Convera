import * as React from "react";

type MetaRowProps = {
  label: string;
  children: React.ReactNode;
};

/** A `<dt>`/`<dd>` pair for the label/value grids used across the workspace info cards. */
function MetaRow({ label, children }: MetaRowProps) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">
        {children}
      </dd>
    </>
  );
}

export { MetaRow };
