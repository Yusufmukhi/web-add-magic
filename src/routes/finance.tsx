import { createFileRoute } from "@tanstack/react-router";
import { FinanceTrackerPage } from "@/pages/finance/FinanceTrackerPage";

export const Route = createFileRoute("/finance")({
  component: FinanceTrackerPage,
});
