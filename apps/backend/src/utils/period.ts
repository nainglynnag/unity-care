// Supported period values across all dashboard endpoints.
// "all" means no date filter — full history.
export type Period = "7d" | "30d" | "90d" | "1y" | "all";

// Granularity for time-series chart data.
// Derived automatically from period:
//   7d  -> daily   (7 data points)
//   30d -> daily   (30 data points)
//   90d -> weekly  (13 data points)
//   1y  -> monthly (12 data points)
//   all -> monthly (as many months as data exists)
export type Granularity = "day" | "week" | "month";

export interface PeriodRange {
  from: Date | null; // null = no lower bound (all-time)
  granularity: Granularity;
}

export function resolvePeriod(period: Period): PeriodRange {
  const now = new Date();

  switch (period) {
    case "7d":
      return {
        from: new Date(now.getTime() - 7 * 86_400_000),
        granularity: "day",
      };
    case "30d":
      return {
        from: new Date(now.getTime() - 30 * 86_400_000),
        granularity: "day",
      };
    case "90d":
      return {
        from: new Date(now.getTime() - 90 * 86_400_000),
        granularity: "week",
      };
    case "1y":
      return {
        from: new Date(now.getTime() - 365 * 86_400_000),
        granularity: "month",
      };
    case "all":
      return { from: null, granularity: "month" };
  }
}

// Build a Prisma-compatible gte filter from a PeriodRange.
// Returns undefined (no filter) when from=null (all-time).
export function periodFilter(from: Date | null): { gte: Date } | undefined {
  return from ? { gte: from } : undefined;
}

// Delta calculation helper.
// Returns { current, previous, changePercent } for trend indicators.
export function calcDelta(current: number, previous: number) {
  const changePercent =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : Math.round(((current - previous) / previous) * 100 * 10) / 10;

  return { current, previous, changePercent };
}
