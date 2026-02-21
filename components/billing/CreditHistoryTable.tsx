import { format } from "date-fns";
import { ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@bfeai/ui";
import type { CreditTransaction } from "@/services/BillingService";

const TYPE_LABELS: Record<string, string> = {
  subscription_allocation: "Monthly allocation",
  topup_purchase: "Top-up purchase",
  usage_deduction: "Usage",
  admin_adjustment: "Adjustment",
  refund: "Refund",
  expiry: "Expired",
  retention_bonus: "Bonus",
  trial_allocation: "Trial credits",
};

/** Make raw operation descriptions human-readable. */
const friendlyDescription = (desc: string | null, appKey: string | null): string => {
  if (!desc) return "-";

  // Normalize: strip app key suffix like " (keywords)" or " (labs)"
  let clean = desc.replace(/\s*\((keywords|labs)\)\s*\.{0,3}$/i, "").trim();

  // Map known operation codes to friendly names
  const opMap: Record<string, string> = {
    // Keywords operations
    keyword_report: "Keyword research report",
    keyword_report_wide: "Keyword research report (wide)",
    keyword_report_url: "URL-based keyword report",
    csv_import: "CSV keyword import",
    // LABS operations
    scan_single: "AI visibility scan",
    scan_batch: "Batch visibility scan",
    diagnosis: "Invisibility diagnosis",
    report_generate: "Visibility report",
    // Credit operations
    "Monthly allocation": "Monthly subscription credits",
    "Monthly credits": "Monthly subscription credits",
    "Trial credits": "Trial starter credits",
  };

  // Check for exact match first
  if (opMap[clean]) {
    const appLabel = appKey === "labs" ? " (LABS)" : appKey === "keywords" ? " (Keywords)" : "";
    return opMap[clean] + appLabel;
  }

  // Check for partial match (e.g., "Refund for keyword_report")
  if (clean.startsWith("Refund for ")) {
    const op = clean.replace("Refund for ", "").trim();
    const friendlyOp = opMap[op] || op.replace(/_/g, " ");
    return `Refund — ${friendlyOp}`;
  }

  // Fallback: replace underscores with spaces and capitalize first letter
  clean = clean.replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

type CreditHistoryTableProps = {
  transactions: CreditTransaction[];
  total: number;
  isLoading?: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export const CreditHistoryTable = ({
  transactions,
  total,
  isLoading,
  page,
  pageSize,
  onPageChange,
}: CreditHistoryTableProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
        No credit transactions yet. Subscribe to an app or purchase a top-up pack to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => {
              const isCredit = txn.amount > 0;
              return (
                <TableRow key={txn.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(txn.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {TYPE_LABELS[txn.type] ?? txn.type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {friendlyDescription(txn.description, txn.app_key)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-medium ${
                        isCredit ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                      )}
                      {isCredit ? "+" : ""}
                      {txn.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-foreground">
                    {txn.balance_after.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} of{" "}
            {total.toLocaleString()} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
