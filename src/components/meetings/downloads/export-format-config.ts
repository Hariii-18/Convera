import { Braces, FileText, FileType, Type, type LucideIcon } from "lucide-react";

import type { ExportFormat } from "@/components/meetings/downloads/types";

export const exportFormatConfig: Record<
  ExportFormat,
  { label: string; extension: string; description: string; icon: LucideIcon }
> = {
  pdf: {
    label: "PDF",
    extension: ".pdf",
    description: "Formatted document with headings and speaker labels.",
    icon: FileType,
  },
  docx: {
    label: "DOCX",
    extension: ".docx",
    description: "Editable Word document for further edits.",
    icon: FileText,
  },
  txt: {
    label: "TXT",
    extension: ".txt",
    description: "Plain text transcript with no formatting.",
    icon: Type,
  },
  json: {
    label: "JSON",
    extension: ".json",
    description: "Structured data for programmatic use.",
    icon: Braces,
  },
};
