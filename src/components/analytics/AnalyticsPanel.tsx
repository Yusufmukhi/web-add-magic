import { SectorAllocation } from "./SectorAllocation";
import { SectorEditor } from "./SectorEditor";
import { PortfolioVsNiftyChart } from "./PortfolioVsNiftyChart";
import { ReturnsComparison } from "./ReturnsComparison";
import { HoldingsHeatmap } from "./HoldingsHeatmap";
import { CompareChart } from "./CompareChart";
import { RiskView } from "./RiskView";
import { StressTest } from "./StressTest";
import { DrawdownView } from "./DrawdownView";
import { BetaView } from "./BetaView";
import { LiquidityView } from "./LiquidityView";
import { VaRView } from "./VaRView";
import { FactorView } from "./FactorView";
import { MonteCarloView } from "./MonteCarloView";
import { CorrelationMatrix } from "./CorrelationMatrix";
import type { Holding } from "@/types/portfolio.types";
import type { QuoteResult } from "@/hooks/useStockQuote";

interface Props {
  portfolio: Holding[];
  results: QuoteResult[];
}

export function AnalyticsPanel({ portfolio, results }: Props) {
  return (
    <div className="space-y-6">
      <RiskView portfolio={portfolio} results={results} />
      <StressTest portfolio={portfolio} results={results} />
      <DrawdownView portfolio={portfolio} results={results} />
      <BetaView portfolio={portfolio} results={results} />
      <LiquidityView portfolio={portfolio} results={results} />
      <VaRView portfolio={portfolio} results={results} />
      <FactorView portfolio={portfolio} results={results} />
      <MonteCarloView portfolio={portfolio} results={results} />
      <CorrelationMatrix portfolio={portfolio} />
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
