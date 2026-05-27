import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StockDetailPage } from "@/components/detail/StockDetailPage";

export const Route = createFileRoute("/stock/$symbol")({
  component: StockDetailRouteComponent,
});

function StockDetailRouteComponent() {
  const { symbol } = Route.useParams();
  const navigate = useNavigate();
  return (
    <StockDetailPage
      symbol={symbol.toUpperCase()}
      onBack={() => navigate({ to: "/" })}
    />
  );
}
