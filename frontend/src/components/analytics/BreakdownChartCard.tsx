import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsBreakdownItem } from "@/types";
import { cn, formatCompactNumber, formatCurrency } from "@/lib/utils";

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

type BreakdownChartCardProps = {
  title: string;
  description: string;
  items?: AnalyticsBreakdownItem[];
  isLoading?: boolean;
  isError?: boolean;
  barClassName?: string;
  badgeClassName?: string;
  displayDecimals: number;
};

export function BreakdownChartCard({
  title,
  description,
  items = [],
  isLoading,
  isError,
  barClassName,
  badgeClassName,
  displayDecimals,
}: BreakdownChartCardProps) {
  const visibleItems = items.slice(0, 6);
  const maxRequests = Math.max(...visibleItems.map((item) => item.requests), 1);

  return (
    <Card className="overflow-hidden border-0">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-4 w-1/3 bg-muted" />
              <div className="mt-3 h-2 rounded-full bg-muted" />
            </div>
          ))
        ) : isError ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            排行数据加载失败
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            当前时间范围暂无维度排行数据
          </div>
        ) : (
          visibleItems.map((item, index) => {
            const width = item.requests > 0 ? Math.max((item.requests / maxRequests) * 100, 6) : 0;

            return (
              <div key={`${title}-${item.label}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          badgeClassName || "bg-primary/10 text-primary",
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="truncate font-medium">
                        {item.label}

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>成功率 {formatPercent(item.successRate)}</span>
                          <span>消耗 {formatCompactNumber(item.totalTokens)}</span>
                          <span>费用 {formatCurrency(item.totalCost, displayDecimals)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCompactNumber(item.requests)}</div>
                    <div className="text-xs text-muted-foreground">{Math.round(item.avgLatencyMs)} ms</div>
                  </div>
                </div>

                <div className="mt-2 h-0.5 bg-muted">
                  <div
                    className={cn("h-2 -translate-y-0.75 bg-gradient-to-r from-primary to-primary/50 -skew-x-12", barClassName)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
