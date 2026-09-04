import * as React from "react";
import { Languages, Loader2, Pencil, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TRANSLATION_LANGUAGES } from "@/features/transcripts/types";
import type { TranslationLanguage } from "@/features/transcripts/types";

type TranscriptView = "raw" | "normalized" | "translated";

type TranscriptToolbarProps = React.ComponentProps<"div"> & {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
  /** Persists the current edits. Only used while `editMode` is on — when
   * omitted, the edit toggle behaves as a plain on/off switch with no
   * Save/Cancel step (e.g. the style guide's uncontrolled demo). */
  onSave?: () => void;
  saving?: boolean;
  /** Pre-counted word total, shown as-is. */
  wordCount?: number;
  /** Full transcript text, used by the copy button. */
  transcriptText?: string;
  onCopy?: () => void;
  /** Which transcript variant is currently shown. Omit to hide the toggle entirely. */
  view?: TranscriptView;
  onViewChange?: (view: TranscriptView) => void;
  /** Whether a normalized transcript has been generated for this meeting yet. */
  hasNormalized?: boolean;
  isNormalizing?: boolean;
  onGenerateNormalized?: () => void;
  /** Whether a translation into `translationLanguage` has been generated yet. */
  hasTranslated?: boolean;
  isTranslating?: boolean;
  /** Target language selected in the translate dropdown. */
  translationLanguage?: TranslationLanguage;
  onTranslationLanguageChange?: (language: TranslationLanguage) => void;
  onGenerateTranslation?: () => void;
};

/**
 * Action bar for the transcript: search, word count, edit toggle, and copy.
 * Every action is a callback into the caller — this component holds no
 * transcript state of its own.
 */
function TranscriptToolbar({
  className,
  searchValue = "",
  onSearchChange,
  editMode = false,
  onEditModeChange,
  onSave,
  saving = false,
  wordCount,
  transcriptText = "",
  onCopy,
  view,
  onViewChange,
  hasNormalized = false,
  isNormalizing = false,
  onGenerateNormalized,
  hasTranslated = false,
  isTranslating = false,
  translationLanguage = "en",
  onTranslationLanguageChange,
  onGenerateTranslation,
  ...props
}: TranscriptToolbarProps) {
  return (
    <div
      data-slot="transcript-toolbar"
      className={cn("flex flex-wrap items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      <SearchInput
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
        onClear={onSearchChange ? () => onSearchChange("") : undefined}
        placeholder="Search transcript…"
        containerClassName="max-w-xs"
        aria-label="Search transcript"
      />

      {wordCount !== undefined && (
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {wordCount.toLocaleString("en-US")} words
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {view !== undefined && (
          <>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              <Button
                type="button"
                variant={view === "raw" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "raw"}
                onClick={() => onViewChange?.("raw")}
              >
                Raw
              </Button>
              <Button
                type="button"
                variant={view === "normalized" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "normalized"}
                disabled={!hasNormalized}
                onClick={() => onViewChange?.("normalized")}
              >
                Normalized
              </Button>
              <Button
                type="button"
                variant={view === "translated" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "translated"}
                disabled={!hasTranslated}
                onClick={() => onViewChange?.("translated")}
              >
                Translated
              </Button>
            </div>

            {!hasNormalized && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGenerateNormalized}
                disabled={!onGenerateNormalized || isNormalizing}
              >
                <Sparkles data-icon="inline-start" />
                {isNormalizing ? "Normalizing…" : "Normalize"}
              </Button>
            )}

            <Select
              value={translationLanguage}
              onValueChange={(value) =>
                onTranslationLanguageChange?.(value as TranslationLanguage)
              }
            >
              <SelectTrigger aria-label="Translation target language" className="h-8 w-28">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {language.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerateTranslation}
              disabled={!onGenerateTranslation || isTranslating}
            >
              <Languages data-icon="inline-start" />
              {isTranslating ? "Translating…" : "Translate"}
            </Button>

            <Separator orientation="vertical" className="h-5" />
          </>
        )}

        {editMode && onSave ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditModeChange?.(false)}
              disabled={saving}
            >
              <X data-icon="inline-start" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant={editMode ? "secondary" : "outline"}
            size="sm"
            aria-pressed={editMode}
            onClick={() => onEditModeChange?.(!editMode)}
            disabled={!onEditModeChange}
          >
            <Pencil data-icon="inline-start" />
            {editMode ? "Editing" : "Edit"}
          </Button>
        )}

        <Separator orientation="vertical" className="h-5" />

        <CopyButton text={transcriptText} label="Copy" onCopy={onCopy} />
      </div>
    </div>
  );
}

export { TranscriptToolbar };
export type { TranscriptToolbarProps };
