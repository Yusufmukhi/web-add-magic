import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HoldingDetailPage } from "@/components/detail/HoldingDetailPage";

export const Route = createFileRoute("/holding/$symbol")({
  component: HoldingDetailRouteComponent,
});

function HoldingDetailRouteComponent() {
  const { symbol } = Route.useParams();
  const navigate = useNavigate();
  return (
    <HoldingDetailPage
      symbol={symbol.toUpperCase()}
      onBack={() => navigate({ to: "/" })}
    />
  );
}
