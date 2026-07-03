import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  Clock,
  Bot,
  Percent,
} from "lucide-react";
import React from "react";

export function DashboardPage() {
  const { data: stats, isLoading, isError } = useDashboardStats();

  return (
    <div className="bg-white min-h-full rounded-2xl p-8 border border-gray-200 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-black tracking-tight">
          Dashboard
        </h1>
        {isError && (
          <span className="text-red-700 text-sm bg-red-50 px-3 py-1 rounded-full border border-red-200">
            Failed to load stats
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          label="Total Tickets"
          value={stats?.totalTickets}
          isLoading={isLoading}
          icon={<Ticket className="w-5 h-5 text-black" />}
          valueColor="text-black"
        />
        <StatCard
          label="Open Tickets"
          value={stats?.openTickets}
          isLoading={isLoading}
          icon={<Clock className="w-5 h-5 text-black" />}
          valueColor="text-black"
        />
        <StatCard
          label="AI Resolved"
          value={stats?.aiResolvedCount}
          isLoading={isLoading}
          icon={<Bot className="w-5 h-5 text-black" />}
          valueColor="text-black"
        />
        <StatCard
          label="AI Success Rate"
          value={stats?.aiResolvedPct !== undefined ? `${stats.aiResolvedPct}%` : undefined}
          isLoading={isLoading}
          icon={<Percent className="w-5 h-5 text-black" />}
          valueColor="text-black"
        />
      </div>

      {/* Ticket Volume Bar Chart */}
      <div className="mt-10 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-black tracking-tight">Ticket Volume</h2>
          <p className="text-sm text-black opacity-70 mt-1">Total number of tickets per day over the past 30 days</p>
        </div>

        {isLoading ? (
          <div>
            <div className="h-64 flex items-end gap-1.5 pt-4">
              {Array.from({ length: 30 }).map((_, idx) => {
                // Generate a stable pseudorandom height for the skeleton bars
                const heightPercent = 10 + (Math.sin(idx) * 0.5 + 0.5) * 60;
                return (
                  <Skeleton
                    key={idx}
                    className="flex-1 bg-gray-100 rounded-t-sm"
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-3 px-1">
              <Skeleton className="h-4 w-12 bg-gray-150" />
              <Skeleton className="h-4 w-12 bg-gray-150" />
              <Skeleton className="h-4 w-12 bg-gray-150" />
            </div>
          </div>
        ) : (
          <div>
            <div className="relative h-64 flex items-end">
              {/* Horizontal grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-b border-dashed border-gray-100 w-full h-0" />
                <div className="border-b border-dashed border-gray-100 w-full h-0" />
                <div className="border-b border-dashed border-gray-100 w-full h-0" />
                <div className="border-b border-gray-250 w-full h-0" />
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
                          <div className="bg-black text-white text-xs rounded-lg py-1.5 px-3 shadow-xl whitespace-nowrap flex items-center gap-1.5">
                            <span className="font-semibold text-gray-300">
                              {new Date(day.date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-gray-600">|</span>
                            <span className="text-white font-bold">
                              {day.count} {day.count === 1 ? "ticket" : "tickets"}
                            </span>
                          </div>
                          {/* Arrow */}
                          <div className="w-1.5 h-1.5 bg-black rotate-45 -mt-0.5" />
                        </div>

                        {/* Bar */}
                        <div
                          className="w-full bg-black hover:bg-neutral-800 rounded-t-sm transition-all duration-300 cursor-pointer min-h-[2px]"
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
              <div className="flex justify-between mt-3 px-1 text-xs text-black font-semibold tracking-wide">
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
  valueColor = "text-black",
}: {
  label: string;
  value: string | number | undefined;
  isLoading: boolean;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 shadow-sm group hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-black tracking-wide">{label}</p>
        <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
          {icon}
        </div>
      </div>
      
      <div className="mt-2">
        {isLoading ? (
          <Skeleton className="h-10 w-20 bg-gray-200 rounded-lg" />
        ) : (
          <p className={`text-4xl font-bold tracking-tight ${valueColor}`}>
            {value ?? "—"}
          </p>
        )}
      </div>
    </div>
  );
}
