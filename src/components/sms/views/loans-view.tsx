"use client";

import { LoansSection } from "../loans-section";
import { useLoans } from "../use-sms-data";
import { Landmark } from "lucide-react";
import { ScreenGuideCard } from "../screen-guide-card";

export function LoansView() {
  const loansQ = useLoans();

  return (
    <div className="space-y-4">
      <ScreenGuideCard viewKey="loans" />
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Loans & EMIs</h2>
            <p className="text-xs text-muted-foreground">
              Track every loan, EMI schedule and lender document in one place.
            </p>
          </div>
        </div>
      </div>

      <LoansSection
        loans={loansQ.data?.loans}
        upcoming={loansQ.data?.upcoming}
        loading={loansQ.isLoading}
      />
    </div>
  );
}
