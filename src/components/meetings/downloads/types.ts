/**
 * Domain types for the Downloads & Export Center. Shared by DownloadsPanel
 * and its subcomponents so a real page can pass one data shape straight
 * through.
 */

export type ExportFormat = "pdf" | "docx" | "txt" | "json";

export type ExportCardData = {
  format: ExportFormat;
  /** Overrides the format's default description. */
  description?: string;
  fileSizeBytes?: number;
  lastGeneratedAt?: string | Date;
};

export type ExportHistoryEntry = {
  id: string;
  fileName: string;
  format: ExportFormat;
  generatedAt: string | Date;
};
