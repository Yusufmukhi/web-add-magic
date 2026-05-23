import { ExternalLink, Newspaper } from "lucide-react";
import { useStockNews } from "@/hooks/useStockNews";
import { Skeleton } from "@/components/ui/skeleton";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StockNewsPanel({ ticker }: { ticker: string }) {
  const { data: news, isLoading } = useStockNews(ticker);

  return (
    <div>
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Newspaper className="h-3.5 w-3.5" /> Latest News
      </h3>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (!news || news.length === 0) && (
        <p className="text-xs text-muted-foreground">No recent news found.</p>
      )}

      {!isLoading && news && news.length > 0 && (
        <div className="space-y-2">
          {news.map((item) => (
            <a
              key={item.uuid}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/50 minimal:rounded-none"
            >
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug group-hover:text-primary">
                  {item.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{item.publisher}</span>
                  {item.publishedAt && (
                    <>
                      <span>·</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </>
                  )}
                  <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
