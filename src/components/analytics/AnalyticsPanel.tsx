import { SectorAllocation } from "./SectorAllocation";
import { SectorEditor } from "./SectorEditor";
import { PortfolioVsNiftyChart } from "./PortfolioVsNiftyChart";
import { ReturnsComparison } from "./ReturnsComparison";
import { HoldingsHeatmap } from "./HoldingsHeatmap";
import { CompareChart } from "./CompareChart";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function AnalyticsPanel({ portfolio, results }: Props) {
  return (
    <div className="space-y-6">
      <PortfolioVsNiftyChart portfolio={portfolio} />
      <ReturnsComparison portfolio={portfolio} />
      <HoldingsHeatmap portfolio={portfolio} results={results} />
      <CompareChart />
      <div className="grid gap-6 lg:grid-cols-2">
        <SectorAllocation results={results} />
        <SectorEditor results={results} />
      </div>
    </div>
  );
}
