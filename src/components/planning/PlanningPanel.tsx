import { Repeat, Target, Coins, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SIPPanel } from "@/components/sip/SIPPanel";
import { GoalsPanel } from "@/components/goals/GoalsPanel";
import { DividendsPanel } from "@/components/dividends/DividendsPanel";
import { TaxReportPanel } from "@/components/tax/TaxReportPanel";
import type { Transaction } from "@/types/portfolio.types";

interface Props {
  prices: Record<string, number>;
  portfolioValue: number;
  transactions: Transaction[];
}

export function PlanningPanel({ prices, portfolioValue, transactions }: Props) {
  return (
    <Tabs defaultValue="sip" className="space-y-4">
      <TabsList className="bg-muted/40">
        <TabsTrigger value="sip" className="gap-1.5"><Repeat className="h-3.5 w-3.5" /> SIP</TabsTrigger>
        <TabsTrigger value="goals" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Goals</TabsTrigger>
        <TabsTrigger value="dividends" className="gap-1.5"><Coins className="h-3.5 w-3.5" /> Dividends</TabsTrigger>
        <TabsTrigger value="tax" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Tax</TabsTrigger>
      </TabsList>
      <TabsContent value="sip"><SIPPanel prices={prices} /></TabsContent>
      <TabsContent value="goals"><GoalsPanel portfolioValue={portfolioValue} /></TabsContent>
      <TabsContent value="dividends"><DividendsPanel /></TabsContent>
      <TabsContent value="tax"><TaxReportPanel transactions={transactions} /></TabsContent>
    </Tabs>
  );
}
