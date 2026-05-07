"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@bfeai/ui";
import { useDismissSkippedScanBanner } from "@/hooks/useSkippedScanBanner";

interface Props {
  /** ISO timestamp of the most recent skipped scan. */
  skippedAt: string;
}

/**
 * Banner shown on /credits when the user's most recent scheduled scan was
 * skipped because they ran out of credits. Dismissable; the dismiss state
 * is stored server-side via `credits-skipped-scan-dismiss`.
 */
export function SkippedScanBanner({ skippedAt }: Props) {
  const { mutate, isPending } = useDismissSkippedScanBanner();
  const dateStr = new Date(skippedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">
            Your scheduled scan was skipped on {dateStr} because you were out of credits.
          </p>
          <p className="text-sm mt-1">Top up below to resume scheduled scans.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss banner"
          onClick={() => mutate()}
          disabled={isPending}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
