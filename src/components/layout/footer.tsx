import Link from "next/link";

import { Logo } from "@/components/shared/logo";

type FooterLink = {
  label: string;
  href?: string;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const footerColumns: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing" },
    ],
  },
  {
    title: "Resources",
    links: [{ label: "Docs" }, { label: "Changelog" }, { label: "Support" }],
  },
  {
    title: "Company",
    links: [{ label: "About" }, { label: "Privacy" }, { label: "Terms" }],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
            <Logo />
            <p className="max-w-[22rem] text-sm text-muted-foreground">
              Turn recordings and live meetings into transcripts, summaries,
              and timelines automatically.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">
                {column.title}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="cursor-default text-sm text-muted-foreground/50 select-none"
                      >
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {year} Converra. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
