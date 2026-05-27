import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HoldingDetailPage } from "@/components/detail/HoldingDetailPage";

export const Route = createFileRoute("/holding/$symbol")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: (search.from as string) ?? "watchlist",
  }),
  component: HoldingDetailRouteComponent,
});

function HoldingDetailRouteComponent() {
  const { symbol } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <HoldingDetailPage
      symbol={symbol.toUpperCase()}
      onBack={() => navigate({ to: "/", search: { tab: from } })}
    />
  );
}
