import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockNews } from "@/hooks/useStockNews";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function StockNewsPanel({ ticker }: { ticker: string }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useStockNews(ticker);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Newspaper className="h-3.5 w-3.5" /> Latest News
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => qc.invalidateQueries({ queryKey: ["news", ticker] })}
          aria-label="Refresh news"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-xs text-muted-foreground">Couldn't load news right now.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent news for {ticker}.</p>
      ) : (
        <ul className="space-y-2">
          {data.slice(0, 8).map((n) => (
            <li key={n.uuid}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 rounded-lg border border-border bg-background/40 p-3 transition hover:border-primary/40 hover:bg-accent/30 minimal:rounded-none"
              >
                {n.thumbnail && (
                  <img
                    src={n.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 flex-shrink-0 rounded-md object-cover minimal:rounded-none"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">
                    {n.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="truncate">{n.publisher}</span>
                    {n.publishedAt && <span>• {formatTime(n.publishedAt)}</span>}
                    <ExternalLink className="ml-auto h-3 w-3 flex-shrink-0 opacity-0 transition group-hover:opacity-100" />
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
