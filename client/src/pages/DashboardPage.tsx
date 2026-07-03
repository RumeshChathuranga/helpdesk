import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Clock,
  Bot,
  Percent,
  Sparkles,
} from "lucide-react";
import React from "react";

export function DashboardPage() {
  const { data: stats, isLoading, isError } = useDashboardStats();

  return (
    <div className="bg-card/40 min-h-full rounded-2xl p-8 border border-border/80 shadow-lg backdrop-blur-sm">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time operations summary and AI performance metrics.
          </p>
        </div>
        {isError && (
          <span className="text-red-400 text-sm bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
            Failed to load stats
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label="Total Tickets"
          value={stats?.totalTickets}
          isLoading={isLoading}
          icon={<Ticket className="w-5 h-5" />}
          valueColor="text-foreground"
        />
        <StatCard
          label="Open Tickets"
          value={stats?.openTickets}
          isLoading={isLoading}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          valueColor="text-amber-500"
        />
        <StatCard
          label="AI Resolved"
          value={stats?.aiResolvedCount}
          isLoading={isLoading}
          icon={<Bot className="w-5 h-5 text-emerald-500" />}
          valueColor="text-emerald-400"
        />
        <StatCard
          label="AI Success Rate"
          value={stats?.aiResolvedPct !== undefined ? `${stats.aiResolvedPct}%` : undefined}
          isLoading={isLoading}
          icon={<Percent className="w-5 h-5 text-primary" />}
          valueColor="text-primary"
        />
      </div>

      {/* Ticket Volume Bar Chart */}
      <div className="mt-10 rounded-2xl bg-card border border-border p-6 shadow-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Ticket Volume</h2>
            <p className="text-sm text-muted-foreground mt-1">Total number of tickets per day over the past 30 days</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background border border-border px-3 py-1.5 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
            AI Triage Enabled
          </div>
        </div>

        {isLoading ? (
          <div>
            <div className="h-64 flex items-end gap-1.5 pt-4">
              {Array.from({ length: 30 }).map((_, idx) => {
                const heightPercent = 10 + (Math.sin(idx) * 0.5 + 0.5) * 60;
                return (
                  <Skeleton
                    key={idx}
                    className="flex-1 bg-muted/50 rounded-t-md"
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-3 px-1">
              <Skeleton className="h-4 w-12 bg-muted/50" />
              <Skeleton className="h-4 w-12 bg-muted/50" />
              <Skeleton className="h-4 w-12 bg-muted/50" />
            </div>
          </div>
        ) : (
          <div>
            <div className="relative h-64 flex items-end">
              {/* Horizontal grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-border/40 w-full h-0" />
                <div className="border-b border-dashed border-border/40 w-full h-0" />
                <div className="border-b border-dashed border-border/40 w-full h-0" />
                <div className="border-b border-border w-full h-0" />
              </div>

              {/* Bars container */}
              <div className="relative w-full h-full flex items-end justify-between gap-1.5 z-10 pt-4">
                {(() => {
                  const chartData = stats?.chartData || [];
                  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
                  return chartData.map((day, idx) => {
                    const percent = (day.count / maxCount) * 100;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center group relative h-full justify-end"
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-20 transition-all duration-200">
                          <div className="bg-slate-900 border border-border text-white text-xs rounded-xl py-1.5 px-3 shadow-2xl whitespace-nowrap flex items-center gap-1.5">
                            <span className="font-semibold text-gray-400">
                              {new Date(day.date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-gray-700">|</span>
                            <span className="text-white font-bold">
                              {day.count} {day.count === 1 ? "ticket" : "tickets"}
                            </span>
                          </div>
                          {/* Arrow */}
                          <div className="w-1.5 h-1.5 bg-slate-900 border-r border-b border-border rotate-45 -mt-0.5" />
                        </div>

                        {/* Bar */}
                        <div
                          className="w-full bg-primary/70 hover:bg-primary rounded-t-md transition-all duration-300 cursor-pointer min-h-[2px] shadow-[0_0_10px_rgba(59,130,246,0.15)] hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                          style={{ height: `${percent}%` }}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* X Axis Labels */}
            {stats?.chartData && stats.chartData.length > 0 && (
              <div className="flex justify-between mt-4 px-1 text-xs text-muted-foreground font-mono font-medium tracking-wide">
                <span>
                  {new Date(stats.chartData[0].date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span>
                  {new Date(stats.chartData[Math.floor(stats.chartData.length / 2)].date).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" },
                  )}
                </span>
                <span>
                  {new Date(stats.chartData[stats.chartData.length - 1].date).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric" },
                  )}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  isLoading,
  icon,
  valueColor = "text-foreground",
}: {
  label: string;
  value: string | number | undefined;
  isLoading: boolean;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 shadow-md group hover:border-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      {/* Accent glow on hover */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-muted-foreground tracking-wide">{label}</p>
        <div className="p-2.5 bg-secondary/80 rounded-xl border border-border/80 text-foreground group-hover:text-primary-foreground group-hover:bg-primary transition-all duration-300">
          {icon}
        </div>
      </div>
      
      <div className="mt-2">
        {isLoading ? (
          <Skeleton className="h-10 w-24 bg-muted/50 rounded-lg" />
        ) : (
          <p className={`text-4xl font-bold tracking-tight font-mono ${valueColor}`}>
            {value ?? "—"}
          </p>
        )}
      </div>
    </div>
  );
}

